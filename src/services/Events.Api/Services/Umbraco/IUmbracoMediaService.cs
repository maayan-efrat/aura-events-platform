namespace Events.Api.Services.Umbraco;

public interface IUmbracoMediaService
{
    /// <summary>
    /// Uploads a ticket's QR PNG into Umbraco's built-in "Image" media type. Best-effort archival —
    /// callers should catch failures and continue (the registration itself must not depend on this
    /// succeeding). Returns the new media item's key.
    /// </summary>
    Task<Guid> UploadTicketQrAsync(Guid registrationId, byte[] pngBytes, CancellationToken ct);
}
