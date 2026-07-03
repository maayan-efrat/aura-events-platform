using System.ComponentModel.DataAnnotations;

namespace Events.Api.Dtos;

public record CreateEventRequest(
    [Required] string Title,
    [Required] string Slug,
    DateTimeOffset StartAtUtc,
    DateTimeOffset EndAtUtc,
    [Required] string Timezone,
    string? VenueName,
    bool IsVirtual,
    int? Capacity,
    string Status,
    Guid? UmbracoContentKey);

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
    string Status);

public record AvailabilityResponse(Guid EventId, int? Capacity, int RegisteredCount, int WaitlistCount, string Status);

public record RegistrationResponse(Guid RegistrationId, Guid EventId, string Status);

public record MyRegistrationResponse(Guid RegistrationId, Guid EventId, string Status, DateTimeOffset RegisteredAtUtc);

public record CheckInRequest(Guid UserId);

public record CheckInResponse(Guid RegistrationId, string Status, DateTimeOffset CheckedInAtUtc);

public record ErrorResponse(ErrorBody Error);
public record ErrorBody(string Code, string Message);
