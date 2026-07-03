namespace Events.Api.Entities;

public class EventTrackingLog
{
    public long TrackingId { get; set; }
    public Guid? EventId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? AnonymousId { get; set; }
    public string? SessionId { get; set; }
    public required string EventType { get; set; }
    public string? MetadataJson { get; set; }
    public DateTimeOffset OccurredAtUtc { get; set; }
}
