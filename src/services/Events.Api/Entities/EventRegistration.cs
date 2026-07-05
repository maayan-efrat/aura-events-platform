namespace Events.Api.Entities;

public static class RegistrationStatus
{
    public const string Registered = "Registered";
    public const string Waitlisted = "Waitlisted";
    public const string Cancelled = "Cancelled";
    public const string CheckedIn = "CheckedIn";
}

public class EventRegistration
{
    public Guid RegistrationId { get; set; }
    public Guid EventId { get; set; }
    public Event Event { get; set; } = null!;
    public Guid UserId { get; set; }
    public string Status { get; set; } = RegistrationStatus.Registered;
    public DateTimeOffset RegisteredAtUtc { get; set; }
    public DateTimeOffset? CancelledAtUtc { get; set; }
    public DateTimeOffset? CheckedInAtUtc { get; set; }

    /// <summary>
    /// Opaque random token encoded into the registration's QR ticket. Deliberately distinct from
    /// <see cref="RegistrationId"/> so a scanned/leaked QR isn't equivalent to the id already used
    /// in ordinary API URLs.
    /// </summary>
    public string TicketCode { get; set; } = null!;

    /// <summary>Umbraco Media node key for the archived QR PNG, if the best-effort upload succeeded.</summary>
    public Guid? QrMediaKey { get; set; }

    /// <summary>Set when the Umbraco Media upload failed; the registration itself still succeeds.</summary>
    public string? QrSyncError { get; set; }
}
