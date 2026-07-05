namespace Events.Api.Services.Qr;

public interface IQrCodeService
{
    /// <summary>Generates a fresh, opaque random ticket token to encode into a registration's QR.</summary>
    string GenerateTicketCode();

    /// <summary>Renders a PNG QR code encoding <paramref name="ticketCode"/>. Deterministic — same input, same bytes.</summary>
    byte[] GeneratePngBytes(string ticketCode);
}
