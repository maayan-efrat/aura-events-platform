using System.ComponentModel.DataAnnotations;

namespace Events.Api.Dtos;

public record EventContentRequest(
    [Required] string Summary,
    [Required] string Description,
    [Required] string SeoTitle,
    [Required] string SeoDescription,
    string? HeroImageBase64 = null,
    string? HeroImageFileName = null,
    string? HeroImageContentType = null);

public record CreateEventRequest(
    [Required] string Title,
    [Required] string Slug,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    [Required] string Timezone,
    string? VenueName,
    bool IsVirtual,
    int? Capacity,
    decimal? Price,
    string Status,
    Guid? UmbracoContentKey,
    EventContentRequest? Content,
    Guid[]? CategoryIds = null);

public record UpdateEventRequest(
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    [Required] string Timezone,
    string? VenueName,
    bool IsVirtual,
    int? Capacity,
    decimal? Price,
    string Status,
    Guid[]? CategoryIds = null);

public record UpdateHeroImageRequest(
    [Required] string HeroImageBase64,
    [Required] string HeroImageFileName,
    string? HeroImageContentType);

public record EventResponse(
    Guid EventId,
    Guid? UmbracoContentKey,
    string Slug,
    string Title,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    string Timezone,
    string? VenueName,
    bool IsVirtual,
    int? Capacity,
    decimal? Price,
    string Status,
    IReadOnlyList<CategoryRef> Categories,
    string? UmbracoSyncError = null);

public record AvailabilityResponse(Guid EventId, int? Capacity, int RegisteredCount, int WaitlistCount, string Status);

public record RegistrationResponse(Guid RegistrationId, Guid EventId, string Status, string? QrSyncError = null);

public record MyRegistrationResponse(
    Guid RegistrationId,
    Guid EventId,
    string EventTitle,
    DateTimeOffset EventStartAtUtc,
    DateTimeOffset EventEndAtUtc,
    string EventTimezone,
    string Status,
    DateTimeOffset RegisteredAtUtc,
    string TicketCode);

public record CheckInRequest(Guid UserId);

public record CheckInByTicketCodeRequest([Required] string TicketCode);

public record CheckInResponse(Guid RegistrationId, string Status, DateTimeOffset CheckedInAtUtc);

public record TicketManifestEntry(Guid RegistrationId, string TicketCode, Guid UserId, string Status);

public record ErrorResponse(ErrorBody Error);
public record ErrorBody(string Code, string Message);
