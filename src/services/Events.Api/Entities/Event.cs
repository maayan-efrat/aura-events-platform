namespace Events.Api.Entities;

public static class EventStatus
{
    public const string Draft = "Draft";
    public const string Published = "Published";
    public const string Cancelled = "Cancelled";
    public const string Completed = "Completed";
}

public class Event
{
    public Guid EventId { get; set; }
    public Guid? UmbracoContentKey { get; set; }
    public required string Slug { get; set; }
    public required string Title { get; set; }
    public DateTimeOffset StartAtUtc { get; set; }
    public DateTimeOffset EndAtUtc { get; set; }
    public required string Timezone { get; set; }
    public string? VenueName { get; set; }
    public bool IsVirtual { get; set; }
    public int? Capacity { get; set; }
    public decimal? Price { get; set; }
    public string Status { get; set; } = EventStatus.Draft;
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public List<EventRegistration> Registrations { get; set; } = [];
}
