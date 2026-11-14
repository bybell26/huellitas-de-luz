using System.Globalization;
using System.Security.Cryptography;
using System.Text;
namespace Mascotas.Api.Services;
// Standard Webhooks v1 HMAC-SHA256. Raw bytes are signed, never a re-serialized JSON body.
public static class WebhookVerifier
{
    public static bool Verify(byte[] raw, string id, string timestamp, string signatures, string secret, long now)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length>256 || !long.TryParse(timestamp, NumberStyles.None, CultureInfo.InvariantCulture,out var time)) return false;
        if (time<now-300 || time>now+300) return false;
        try
        {
            var key=Convert.FromBase64String(secret.StartsWith("whsec_") ? secret[6..] : secret);
            if(key.Length<16) return false;
            var prefix=Encoding.UTF8.GetBytes($"{id}.{timestamp}.");
            var message=new byte[prefix.Length+raw.Length];
            prefix.CopyTo(message,0); raw.CopyTo(message,prefix.Length);
            var expected=HMACSHA256.HashData(key,message);
            foreach(var sig in signatures.Split(' ',StringSplitOptions.RemoveEmptyEntries))
            {
                if(!sig.StartsWith("v1,")) continue;
                try { if(CryptographicOperations.FixedTimeEquals(expected,Convert.FromBase64String(sig[3..]))) return true; }
                catch(FormatException) { }
            }
        } catch(FormatException) { }
        return false;
    }
}
