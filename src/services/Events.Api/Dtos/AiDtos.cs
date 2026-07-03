namespace Events.Api.Dtos;

public record RecommendationsRequest(string? Preferences, int MaxResults = 5);

public record RecommendedEvent(Guid EventId, string Title, DateTimeOffset StartAtUtc, string Reason);

public record RecommendationsResponse(List<RecommendedEvent> Recommendations);

public record GenerateDescriptionRequest(string EventTitle, List<string> Bullets, string? Tone);

/// <summary>Maps 1:1 onto the eventPage content type's summary/description/seoTitle/seoDescription properties (see docs/architecture/01-system-architecture.md §3.1).</summary>
public record GenerateDescriptionResponse(string Summary, string Description, string SeoTitle, string SeoDescription);
