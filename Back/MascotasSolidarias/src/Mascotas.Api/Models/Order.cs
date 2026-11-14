namespace Mascotas.Api.Models;
public static class States
{
    public const string Created="CREATED", QrCreating="QR_CREATING", Pending="PENDING_PAYMENT", QrUnknown="QR_REVIEW_REQUIRED", Paid="PAID", PaymentReview="PAYMENT_REVIEW_REQUIRED", Queued="GENERATION_QUEUED", Generating="GENERATING", Ready="READY", Failed="GENERATION_FAILED";
}
public class Order
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TokenHash { get; set; } = "";
    public int AmountCents { get; set; }
    public string Style { get; set; } = "";
    public string Status { get; set; } = States.Created;
    public string? QrId { get; set; }
    public string? QrString { get; set; }
    public string? QrImage { get; set; }
    public long CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    public long? QrExpiresAt { get; set; }
    public string? TransactionId { get; set; }
    public string? ResultFile { get; set; }
    public bool IsDemo { get; set; }
}
public class WebhookReceipt
{
    public string Id { get; set; } = "";
    public string TransactionId { get; set; } = "";
    public string OrderId { get; set; } = "";
}
public record CreateOrderRequest(decimal AmountMxn, string? Style = null);
public record QrResult(string Id, string QrString, string? QrImage);
public class Settings
{
    public string Mode { get; set; } = "Demo";
    public string ApiKey { get; set; } = "";
    public string ApiKeyId { get; set; } = "";
    public string BankAccountId { get; set; } = "";
    public string WebhookSecret { get; set; } = "";
    public string DataDirectory { get; set; } = "App_Data";
    public string ImageProvider { get; set; } = "Demo";
    public string ImageServiceUrl { get; set; } = "";
    public string ImageServiceKey { get; set; } = "";
    public int MaxOrders { get; set; } = 100;
    public decimal MinAmountMxn { get; set; } = 0.01m;
    // Solo para pruebas: permite cobrar en modo Pey con el generador Demo (SVG marcado DEMO). Debe ser false en producción.
    public bool AllowDemoImageInPey { get; set; } = false;
    // Detras de un proxy de plataforma (Railway): confia en X-Forwarded-For/Proto del proxy. Debe ser false si la API se expone directo.
    public bool TrustProxyHeaders { get; set; } = false;
}
