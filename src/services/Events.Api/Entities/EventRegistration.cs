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
}
