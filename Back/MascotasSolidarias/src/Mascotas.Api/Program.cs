using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Mascotas.Api.Data;
using Mascotas.Api.Models;
using Mascotas.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder=WebApplication.CreateBuilder(args);
// Credenciales locales (archivo ignorado por git). Tiene prioridad sobre appsettings y User Secrets.
builder.Configuration.AddJsonFile("appsettings.Local.json",optional:true,reloadOnChange:false);
builder.Configuration.AddEnvironmentVariables(); // las variables de entorno siguen ganando (servidor, pruebas)
var settings=builder.Configuration.GetSection("App").Get<Settings>() ?? new();
settings.DataDirectory=Path.GetFullPath(settings.DataDirectory,builder.Environment.ContentRootPath);
Directory.CreateDirectory(settings.DataDirectory);
if(settings.Mode is not ("Demo" or "Pey")) throw new InvalidOperationException("App:Mode must be Demo or Pey");
if(settings.ImageProvider is not ("Demo" or "Http")) throw new InvalidOperationException("App:ImageProvider must be Demo or Http");
if(settings.Mode=="Pey" && (string.IsNullOrWhiteSpace(settings.ApiKey) || string.IsNullOrWhiteSpace(settings.WebhookSecret) || (settings.ImageProvider!="Http" && !settings.AllowDemoImageInPey)))
    throw new InvalidOperationException("Pey mode needs ApiKey, WebhookSecret and an Http image provider (or App:AllowDemoImageInPey=true for tests only).");
if(settings.ImageProvider=="Http" && (!Uri.TryCreate(settings.ImageServiceUrl,UriKind.Absolute,out var imageUri) || imageUri.Scheme!="https" || string.IsNullOrWhiteSpace(settings.ImageServiceKey)))
    throw new InvalidOperationException("Http image provider requires HTTPS URL and server-side key");
builder.Services.AddSingleton(settings);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o=> {
    o.SwaggerDoc("v1",new OpenApiInfo{Title="Mascotas Solidarias API",Version="v1"});
    o.AddSecurityDefinition("Bearer",new OpenApiSecurityScheme{Type=SecuritySchemeType.Http,Scheme="bearer",Description="orderToken devuelto al crear la orden"});
    o.AddSecurityRequirement(doc=>new OpenApiSecurityRequirement{[new OpenApiSecuritySchemeReference("Bearer",doc)]=[]});
});
builder.Services.AddDbContext<AppDb>(o=>o.UseSqlite($"Data Source={Path.Combine(settings.DataDirectory,"mascotas.db")}"));
if(settings.Mode=="Pey") builder.Services.AddHttpClient<IPaymentGateway,PeyClient>(c=>c.Timeout=TimeSpan.FromSeconds(25));
else builder.Services.AddSingleton<IPaymentGateway,DemoPaymentGateway>();
if(settings.ImageProvider=="Http") builder.Services.AddHttpClient<IImageGenerator,HttpImageGenerator>(c=>c.Timeout=TimeSpan.FromSeconds(90));
else builder.Services.AddSingleton<IImageGenerator,DemoImageGenerator>();
builder.Services.AddHostedService<GenerationWorker>();
builder.WebHost.ConfigureKestrel(o=>o.Limits.MaxRequestBodySize=8*1024*1024);
builder.Services.AddCors(o=>o.AddDefaultPolicy(p=>p.WithOrigins(builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? ["http://localhost:5173"]).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(o=> {
    o.RejectionStatusCode=429;
    o.AddPolicy("public",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",_=>new FixedWindowRateLimiterOptions{PermitLimit=120,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
});
var app=builder.Build();
using(var scope=app.Services.CreateScope())
{
    var db=scope.ServiceProvider.GetRequiredService<AppDb>(); db.Database.EnsureCreated();
    // Interrupted external calls have unknown outcome. No automatic paid-image retry on restart.
    db.Orders.Where(x=>x.Status==States.Generating).ExecuteUpdate(s=>s.SetProperty(x=>x.Status,States.Failed));
    db.Orders.Where(x=>x.Status==States.QrCreating).ExecuteUpdate(s=>s.SetProperty(x=>x.Status,States.QrUnknown));
}
// Detrás de ngrok/proxy local: usa la IP real del cliente para el rate limit (solo confía en proxies loopback).
app.UseForwardedHeaders(new ForwardedHeadersOptions{ForwardedHeaders=ForwardedHeaders.XForwardedFor|ForwardedHeaders.XForwardedProto});
app.Use(async(ctx,next)=> {
    ctx.Response.Headers.CacheControl="no-store";
    ctx.Response.Headers["X-Content-Type-Options"]="nosniff";
    try { await next(); }
    catch(Exception ex) {
        app.Logger.LogError("Request failed: {Type}",ex.GetType().Name);
        if(!ctx.Response.HasStarted) { ctx.Response.StatusCode=500; await ctx.Response.WriteAsJsonAsync(new {error="Error interno. Revisa el estado de tu orden antes de repetir una operación."}); }
    }
});
if(!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseCors(); app.UseRateLimiter();
if(app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapGet("/",()=>Results.Ok(new {app="Mascotas Solidarias API",mode=settings.Mode, imageProvider=settings.ImageProvider,manual="Ver README.md y demo.http. Sin cobros reales en modo Demo."}));
app.MapGet("/health",()=>Results.Ok(new {status="ok"}));
var orders=app.MapGroup("/api/orders").RequireRateLimiting("public");
orders.MapPost("/",async (CreateOrderRequest input,AppDb db,CancellationToken ct)=> {
    var style=string.IsNullOrWhiteSpace(input.Style) ? "cartoon" : input.Style;
    if(input.AmountMxn<settings.MinAmountMxn || input.AmountMxn>1000 || input.AmountMxn*100!=decimal.Truncate(input.AmountMxn*100)) return Results.BadRequest(new {error=$"Monto permitido: {settings.MinAmountMxn}–1000 MXN, máximo dos decimales."});
    if(style is not ("cartoon" or "watercolor" or "astronaut")) return Results.BadRequest(new {error="Estilo: cartoon, watercolor o astronaut."});
    if(await db.Orders.CountAsync(ct)>=settings.MaxOrders) return Results.Json(new {error="Cupo del MVP alcanzado."},statusCode:429);
    var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    var order=new Order{AmountCents=(int)(input.AmountMxn*100),Style=style,TokenHash=Hash(token),IsDemo=settings.Mode=="Demo"};
    db.Orders.Add(order); await db.SaveChangesAsync(ct);
    return Results.Created($"/api/orders/{order.Id}",new {order.Id,order.Status,orderToken=token,order.IsDemo});
});
orders.MapGet("/{id}",async(string id,HttpRequest req,AppDb db,CancellationToken ct)=> {
    var order=await Authorized(id,req,db,ct); if(order is null) return Results.NotFound();
    return Results.Ok(new {order.Id,order.Status,amountMxn=order.AmountCents/100m,order.Style,order.IsDemo,order.QrExpiresAt,canUploadPhoto=order.Status==States.Paid,canDownload=order.Status==States.Ready});
});
orders.MapPost("/{id}/qr",async(string id,HttpRequest req,AppDb db,IPaymentGateway pey,CancellationToken ct)=> {
    var order=await Authorized(id,req,db,ct); if(order is null) return Results.NotFound();
    if(order.Status==States.Pending) return Results.Ok(new {order.QrId,order.QrString,order.QrImage,order.QrExpiresAt,order.IsDemo});
    if(order.Status!=States.Created) return Results.Conflict(new {error="No se puede crear otro QR. Consulta el estado; no repitas un cobro incierto."});
    var claim=await db.Orders.Where(x=>x.Id==id && x.Status==States.Created).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,States.QrCreating),ct);
    if(claim!=1) return Results.Conflict();
    try {
        var qr=await pey.CreateQr(order,ct); var expiry=DateTimeOffset.UtcNow.AddMinutes(15).ToUnixTimeSeconds();
        await db.Orders.Where(x=>x.Id==id && x.Status==States.QrCreating).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.QrId,qr.Id).SetProperty(x=>x.QrString,qr.QrString).SetProperty(x=>x.QrImage,qr.QrImage).SetProperty(x=>x.QrExpiresAt,expiry).SetProperty(x=>x.Status,States.Pending),CancellationToken.None);
        return Results.Ok(new {qrId=qr.Id,qr.QrString,qr.QrImage,qrExpiresAt=expiry,order.IsDemo});
    } catch(Exception ex) {
        app.Logger.LogWarning("QR result uncertain for {OrderId}: {Type}",id,ex.GetType().Name);
        await db.Orders.Where(x=>x.Id==id && x.Status==States.QrCreating).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,States.QrUnknown),CancellationToken.None);
        return Results.Json(new {error="Resultado de creación de QR incierto. Revisar en pey antes de crear otra orden."},statusCode:502);
    }
});
// Sube la foto (bytes crudos PNG/JPEG, max 5 MB). Solo con orden pagada; encola la generación.
orders.MapPost("/{id}/photo",async(string id,HttpRequest req,AppDb db,CancellationToken ct)=> {
    var order=await Authorized(id,req,db,ct); if(order is null) return Results.NotFound();
    if(order.Status is States.Queued or States.Generating or States.Ready) return Results.Ok(new {order.Status});
    if(order.Status!=States.Paid) return Results.Conflict(new {error="Primero debes pagar el QR."});
    if(req.ContentLength>5*1024*1024) return Results.BadRequest(new {error="Usa PNG/JPEG, máximo 5 MB."});
    using var ms=new MemoryStream(); var buffer=new byte[8192]; int read;
    while((read=await req.Body.ReadAsync(buffer,ct))>0) { if(ms.Length+read>5*1024*1024) return Results.BadRequest(new {error="Usa PNG/JPEG, máximo 5 MB."}); ms.Write(buffer,0,read); }
    var photo=ms.ToArray();
    if(photo.Length<8 || !(photo.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}) || (photo[0]==255 && photo[1]==216 && photo[2]==255))) return Results.BadRequest(new {error="Usa PNG/JPEG, máximo 5 MB."});
    await File.WriteAllBytesAsync(Path.Combine(settings.DataDirectory,id+".input"),photo,ct);
    var n=await db.Orders.Where(x=>x.Id==id && x.Status==States.Paid).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,States.Queued),ct);
    return n==1 ? Results.Accepted($"/api/orders/{id}",new {status=States.Queued}) : Results.Conflict();
}).Accepts<byte[]>("image/png","image/jpeg");
orders.MapGet("/{id}/download",async(string id,HttpRequest req,AppDb db,CancellationToken ct)=> {
    var order=await Authorized(id,req,db,ct); if(order is null) return Results.NotFound();
    if(order.Status!=States.Ready || order.ResultFile is null) return Results.Conflict(new {error="La imagen todavía no está lista."});
    var path=Path.Combine(settings.DataDirectory,order.ResultFile);
    if(!File.Exists(path)) return Results.NotFound();
    return Results.File(path,settings.ImageProvider=="Demo" ? "image/svg+xml":"image/png",settings.ImageProvider=="Demo" ? "DEMO-no-IA.svg":"retrato.png");
});
// No public "mark paid" in real mode. Endpoint is absent outside Development + Demo.
if(app.Environment.IsDevelopment() && settings.Mode=="Demo") orders.MapPost("/{id}/simulate-payment",async(string id,HttpRequest req,AppDb db,CancellationToken ct)=> {
    var order=await Authorized(id,req,db,ct); if(order is null) return Results.NotFound();
    var n=await db.Orders.Where(x=>x.Id==id && x.Status==States.Pending).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,States.Paid),ct);
    return n==1 ? Results.Ok(new {status=States.Paid,demo=true}) : Results.Conflict();
});
app.MapPost("/api/webhooks/pey",async(HttpRequest req,AppDb db,CancellationToken ct)=> {
    if(settings.Mode!="Pey") return Results.NotFound();
    if(req.ContentLength>65536) return Results.StatusCode(413);
    using var ms=new MemoryStream(); var buffer=new byte[8192]; int read;
    while((read=await req.Body.ReadAsync(buffer,ct))>0) { if(ms.Length+read>65536) return Results.StatusCode(413); await ms.WriteAsync(buffer.AsMemory(0,read),ct); }
    var raw=ms.ToArray(); var webhookId=req.Headers["webhook-id"].ToString();
    if(!WebhookVerifier.Verify(raw,webhookId,req.Headers["webhook-timestamp"].ToString(),req.Headers["webhook-signature"].ToString(),settings.WebhookSecret,DateTimeOffset.UtcNow.ToUnixTimeSeconds())) return Results.Unauthorized();
    JsonDocument json; try { json=JsonDocument.Parse(raw); } catch(JsonException) { return Results.BadRequest(); }
    using(json) {
        var p=json.RootElement;
        if(p.ValueKind!=JsonValueKind.Object || !p.TryGetProperty("type",out var type)) return Results.BadRequest();
        if(type.GetString()!="codi.qr.payment_received") return Results.Ok();
        string? Str(string key)=>p.TryGetProperty(key,out var v) && v.ValueKind==JsonValueKind.String ? v.GetString():null;
        var qrId=Str("codiQrId"); var txId=Str("transactionId");
        if(string.IsNullOrWhiteSpace(qrId) || string.IsNullOrWhiteSpace(txId) || !p.TryGetProperty("amount",out var amountEl) || !amountEl.TryGetDecimal(out var amount) || !p.TryGetProperty("datePaid",out var dateEl) || !dateEl.TryGetInt64(out var paidAt)) return Results.BadRequest();
        // La firma HMAC ya autentica a Pey. Si ApiKeyId no está configurado, solo se registra el que llega para poder copiarlo.
        if(string.IsNullOrWhiteSpace(settings.ApiKeyId)) app.Logger.LogWarning("Webhook sin App:ApiKeyId configurado. apiKeyId recibido: {ApiKeyId}",Str("apiKeyId"));
        else if(Str("apiKeyId")!=settings.ApiKeyId) return Results.BadRequest();
        if(!string.IsNullOrEmpty(settings.BankAccountId) && Str("bankAccountId")!=settings.BankAccountId) return Results.BadRequest();
        using var transaction=await db.Database.BeginTransactionAsync(ct);
        if(await db.Receipts.AnyAsync(x=>x.Id==webhookId || x.TransactionId==txId,ct)) return Results.Ok(new {duplicate=true});
        var order=await db.Orders.SingleOrDefaultAsync(x=>x.QrId==qrId,ct);
        if(order is null) return Results.Json(new {error="QR no encontrado; reintentar."},statusCode:503);
        if(amount!=order.AmountCents/100m) return Results.BadRequest(new {error="Monto incorrecto; requiere revisión."});
        if(order.TransactionId is not null && order.TransactionId!=txId) { app.Logger.LogWarning("Additional payment requires manual reconciliation for order {OrderId}",order.Id); return Results.Conflict(); }
        if(order.Status!=States.Pending) return Results.Conflict();
        order.TransactionId=txId;
        order.Status=paidAt>order.QrExpiresAt || paidAt<order.CreatedAt-300 || paidAt>DateTimeOffset.UtcNow.ToUnixTimeSeconds()+300 ? States.PaymentReview : States.Paid;
        db.Receipts.Add(new WebhookReceipt{Id=webhookId,TransactionId=txId,OrderId=order.Id});
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Results.Ok();
    }
});
app.Run();
static string Hash(string token)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
static async Task<Order?> Authorized(string id,HttpRequest req,AppDb db,CancellationToken ct)
{
    var bearer=req.Headers.Authorization.ToString(); if(!bearer.StartsWith("Bearer ") || bearer.Length!=71) return null;
    var hash=Hash(bearer[7..]); return await db.Orders.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id && x.TokenHash==hash,ct);
}
