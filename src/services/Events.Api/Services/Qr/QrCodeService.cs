using System.Security.Cryptography;
using QRCoder;

namespace Events.Api.Services.Qr;

public sealed class QrCodeService : IQrCodeService
{
    public string GenerateTicketCode() => Base64UrlTextEncoder.Encode(RandomNumberGenerator.GetBytes(16));

    public byte[] GeneratePngBytes(string ticketCode)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(ticketCode, QRCodeGenerator.ECCLevel.Q);
        var pngQrCode = new PngByteQRCode(data);
        return pngQrCode.GetGraphic(20);
    }

    private static class Base64UrlTextEncoder
    {
        public static string Encode(byte[] bytes) =>
            Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
