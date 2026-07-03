using System.ComponentModel.DataAnnotations;

namespace Events.Api.Dtos;

public record TrackRequest(
    Guid? EventId,
    Guid? AnonymousId,
    [Required] string EventType,
    string? SessionId,
    Dictionary<string, object>? Metadata);

public record AnalyticsSummaryResponse(
    Guid EventId,
    int PageViews,
    int RegisterClicks,
    int RegistrationsCompleted,
    int CheckIns,
    double ConversionRate);
