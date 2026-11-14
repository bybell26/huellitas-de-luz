using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Mascotas.Api.Models;
namespace Mascotas.Api.Services;
public interface IPaymentGateway { Task<QrResult> CreateQr(Order order, CancellationToken ct); }
public class PeyClient(HttpClient http, Settings settings) : IPaymentGateway
{
    public async Task<QrResult> CreateQr(Order order, CancellationToken ct)
    {
        var body = new Dictionary<string, object> {
            ["amount"] = order.AmountCents/100m, ["concept"]="Retrato mascota",
            ["expiration"]=900, ["numRef"]=RandomNumberGenerator.GetInt32(1,10000000).ToString(),
            ["generateImage"]=true, ["metadata"]=new { orderId=order.Id }
        };
        if (!string.IsNullOrWhiteSpace(settings.BankAccountId)) body["bankAccountId"]=settings.BankAccountId;
        using var req = new HttpRequestMessage(HttpMethod.Post,"https://api.pey.mx/codi/qr");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer",settings.ApiKey);
        req.Content=JsonContent.Create(body);
        using var res=await http.SendAsync(req,ct);
        res.EnsureSuccessStatusCode(); // No retries: an ambiguous failure can have created a QR.
        using var json=JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var root=json.RootElement;
        var id=root.GetProperty("id").GetString();
        var payload=root.GetProperty("qrString").GetString();
        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(payload)) throw new InvalidOperationException("Invalid pey response");
        return new(id,payload,root.TryGetProperty("qrImage",out var image) && image.ValueKind==JsonValueKind.String ? image.GetString() : null);
    }
}
public class DemoPaymentGateway : IPaymentGateway
{
    public Task<QrResult> CreateQr(Order order, CancellationToken ct) => Task.FromResult(new QrResult("demo-"+order.Id,"DEMO_NO_PAGAR_"+order.Id,null));
}
