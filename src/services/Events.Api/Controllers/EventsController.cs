using System.Security.Claims;
using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
[Route("api/events")]
public class EventsController(EventsDbContext db) : ControllerBase
{
    private static readonly string[] ValidStatuses =
        [EventStatus.Draft, EventStatus.Published, EventStatus.Cancelled, EventStatus.Completed];

    [HttpPost]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<EventResponse>> CreateEvent(CreateEventRequest request, CancellationToken ct)
    {
        var status = string.IsNullOrWhiteSpace(request.Status) ? EventStatus.Draft : request.Status;
        if (!ValidStatuses.Contains(status))
        {
            return BadRequest(new ErrorResponse(new ErrorBody("VALIDATION_ERROR", $"Status must be one of: {string.Join(", ", ValidStatuses)}.")));
        }

        var slugTaken = await db.Events.AnyAsync(e => e.Slug == request.Slug, ct);
        if (slugTaken)
        {
            return Conflict(new ErrorResponse(new ErrorBody("SLUG_ALREADY_EXISTS", "An event with this slug already exists.")));
        }

        var @event = new Event
        {
            EventId = Guid.NewGuid(),
            UmbracoContentKey = request.UmbracoContentKey,
            Slug = request.Slug,
            Title = request.Title,
            StartAtUtc = request.StartAtUtc,
            EndAtUtc = request.EndAtUtc,
            Timezone = request.Timezone,
            VenueName = request.VenueName,
            IsVirtual = request.IsVirtual,
            Capacity = request.Capacity,
            Status = status,
            CreatedByUserId = Guid.Parse(User.FindFirstValue("sub")!),
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAvailability), new { eventId = @event.EventId }, ToResponse(@event));
    }

    [HttpGet("{eventId:guid}")]
    public async Task<ActionResult<EventResponse>> GetById(Guid eventId, CancellationToken ct)
    {
        var @event = await db.Events.SingleOrDefaultAsync(e => e.EventId == eventId, ct);
        if (@event is null)
        {
            return NotFound();
        }

        return Ok(ToResponse(@event));
    }

    [HttpGet("{eventId:guid}/availability")]
    public async Task<ActionResult<AvailabilityResponse>> GetAvailability(Guid eventId, CancellationToken ct)
    {
        var @event = await db.Events.SingleOrDefaultAsync(e => e.EventId == eventId, ct);
        if (@event is null)
        {
            return NotFound();
        }

        var registeredCount = await db.EventRegistrations
            .CountAsync(r => r.EventId == eventId && (r.Status == RegistrationStatus.Registered || r.Status == RegistrationStatus.CheckedIn), ct);
        var waitlistCount = await db.EventRegistrations
            .CountAsync(r => r.EventId == eventId && r.Status == RegistrationStatus.Waitlisted, ct);

        var status = @event.Status switch
        {
            EventStatus.Cancelled or EventStatus.Completed => "Closed",
            _ when @event.Capacity is not null && registeredCount >= @event.Capacity => "Full",
            _ => "Open",
        };

        return Ok(new AvailabilityResponse(@event.EventId, @event.Capacity, registeredCount, waitlistCount, status));
    }

    private static EventResponse ToResponse(Event @event) => new(
        @event.EventId, @event.UmbracoContentKey, @event.Slug, @event.Title,
        @event.StartAtUtc, @event.EndAtUtc, @event.Timezone, @event.VenueName,
        @event.IsVirtual, @event.Capacity, @event.Status);
}
