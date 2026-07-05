namespace Events.Api.Entities;

/// <summary>
/// One row per AI recommendations call — lets a user look back at past requests ("recommendation
/// history"). Saving this is best-effort from the caller's side (AiController): a failure here
/// must never break returning recommendations to the user.
/// </summary>
public class AiRecommendationRequest
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? Preferences { get; set; }

    /// <summary>Serialized <c>List&lt;RecommendedEvent&gt;</c> — stored as jsonb, same pattern as EventTrackingLog.MetadataJson.</summary>
    public required string ResultsJson { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
