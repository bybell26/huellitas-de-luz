using Mascotas.Api.Data;
using Mascotas.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace Mascotas.Api.Services;
public interface IImageGenerator { Task<byte[]> Generate(Order order, byte[] photo, CancellationToken ct); }
// Explicit placeholder. Does NOT edit the submitted photo or call an AI provider.
public class DemoImageGenerator : IImageGenerator
{
    public Task<byte[]> Generate(Order order, byte[] photo, CancellationToken ct) => Task.FromResult(System.Text.Encoding.UTF8.GetBytes("""
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#eee8ff"/><text x="400" y="360" text-anchor="middle" font-family="sans-serif" font-size="34">DEMO: imagen de ejemplo</text><text x="400" y="425" text-anchor="middle" font-family="sans-serif" font-size="22">No generada por IA. No es un retrato de tu mascota.</text></svg>
    """));
}
public class DisabledImageGenerator : IImageGenerator
{
    public Task<byte[]> Generate(Order order, byte[] photo, CancellationToken ct) => throw new InvalidOperationException("Configure a real image provider before accepting orders.");
}
public class GenerationWorker(IServiceScopeFactory scopes, Settings settings, IImageGenerator generator, ILogger<GenerationWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while(!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope=scopes.CreateScope(); var db=scope.ServiceProvider.GetRequiredService<AppDb>();
                var order=await db.Orders.AsNoTracking().FirstOrDefaultAsync(x=>x.Status==States.Queued,stoppingToken);
                if(order is not null && await db.Orders.Where(x=>x.Id==order.Id && x.Status==States.Queued).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,States.Generating),stoppingToken)==1)
                {
                    try
                    {
                        var photo=await File.ReadAllBytesAsync(Path.Combine(settings.DataDirectory,order.Id+".input"),stoppingToken);
                        var result=await generator.Generate(order,photo,stoppingToken);
                        // Demo uses SVG; a real provider should use PNG and update download MIME/extension.
                        var filename=order.Id+(settings.ImageProvider=="Demo" ? ".svg" : ".png");
                        await File.WriteAllBytesAsync(Path.Combine(settings.DataDirectory,filename),result,stoppingToken);
                        await db.Orders.Where(x=>x.Id==order.Id && x.Status==States.Generating).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.ResultFile,filename).SetProperty(x=>x.Status,States.Ready),stoppingToken);
                    }
                    catch(Exception ex) when(!stoppingToken.IsCancellationRequested)
                    {
                        log.LogWarning("Generation failed for order {OrderId}: {Type}",order.Id,ex.GetType().Name);
                        await db.Orders.Where(x=>x.Id==order.Id && x.Status==States.Generating).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,States.Failed),stoppingToken);
                    }
                }
                else await Task.Delay(1000,stoppingToken);
            }
            catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) { break; }
            catch(Exception ex) { log.LogError("Worker failure: {Type}",ex.GetType().Name); await Task.Delay(2000,stoppingToken); }
        }
    }
}

// Adapter contract for the image team's service; this is not a specific vendor SDK.
public class HttpImageGenerator(HttpClient http, Settings settings) : IImageGenerator
{
    public async Task<byte[]> Generate(Order order, byte[] photo, CancellationToken ct)
    {
        using var req=new HttpRequestMessage(HttpMethod.Post, settings.ImageServiceUrl);
        req.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",settings.ImageServiceKey);
        req.Content=System.Net.Http.Json.JsonContent.Create(new { orderId=order.Id, style=order.Style, photoBase64=Convert.ToBase64String(photo) });
        using var res=await http.SendAsync(req,ct); res.EnsureSuccessStatusCode();
        using var json=System.Text.Json.JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var bytes=Convert.FromBase64String(json.RootElement.GetProperty("pngBase64").GetString()!);
        if(bytes.Length>10*1024*1024 || bytes.Length<8 || !bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10})) throw new InvalidOperationException("Expected PNG result <=10MB");
        return bytes;
    }
}
