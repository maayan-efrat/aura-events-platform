using System.Security.Claims;
using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
[Authorize]
public class RegistrationsController(EventsDbContext db) : ControllerBase
{
    [HttpPost("api/events/{eventId:guid}/registrations")]
    public async Task<ActionResult<RegistrationResponse>> Register(Guid eventId, CancellationToken ct)
    {
        var userId = GetUserId();

        var @event = await db.Events.SingleOrDefaultAsync(e => e.EventId == eventId, ct);
        if (@event is null)
        {
            return NotFound();
        }

        if (@event.Status is EventStatus.Cancelled or EventStatus.Completed)
        {
            return StatusCode(StatusCodes.Status410Gone,
                new ErrorResponse(new ErrorBody("EVENT_CLOSED", "This event is no longer open for registration.")));
        }

        var existing = await db.EventRegistrations
            .SingleOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId, ct);
        if (existing is not null && existing.Status != RegistrationStatus.Cancelled)
        {
            return Conflict(new ErrorResponse(new ErrorBody("ALREADY_REGISTERED", "You are already registered for this event.")));
        }

        // Capacity check-then-act: acceptable race window for MVP volume. The unique
        // (event_id, user_id) constraint still prevents duplicate registrations under contention.
        var registeredCount = await db.EventRegistrations
            .CountAsync(r => r.EventId == eventId && (r.Status == RegistrationStatus.Registered || r.Status == RegistrationStatus.CheckedIn), ct);
        var status = @event.Capacity is not null && registeredCount >= @event.Capacity
            ? RegistrationStatus.Waitlisted
            : RegistrationStatus.Registered;

        EventRegistration registration;
        if (existing is not null)
        {
            existing.Status = status;
            existing.CancelledAtUtc = null;
            existing.RegisteredAtUtc = DateTimeOffset.UtcNow;
            registration = existing;
        }
        else
        {
            registration = new EventRegistration
            {
                RegistrationId = Guid.NewGuid(),
                EventId = eventId,
                UserId = userId,
                Status = status,
                RegisteredAtUtc = DateTimeOffset.UtcNow,
            };
            db.EventRegistrations.Add(registration);
        }

        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Register), new { eventId },
            new RegistrationResponse(registration.RegistrationId, eventId, registration.Status));
    }

    [HttpDelete("api/events/{eventId:guid}/registrations/me")]
    public async Task<IActionResult> CancelMyRegistration(Guid eventId, CancellationToken ct)
    {
        var userId = GetUserId();

        var registration = await db.EventRegistrations
            .SingleOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId, ct);
        if (registration is null || registration.Status == RegistrationStatus.Cancelled)
        {
            return NoContent();
        }

        registration.Status = RegistrationStatus.Cancelled;
        registration.CancelledAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpGet("api/users/me/registrations")]
    public async Task<ActionResult<IEnumerable<MyRegistrationResponse>>> GetMyRegistrations(CancellationToken ct)
    {
        var userId = GetUserId();

        var registrations = await db.EventRegistrations
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RegisteredAtUtc)
            .Select(r => new MyRegistrationResponse(r.RegistrationId, r.EventId, r.Status, r.RegisteredAtUtc))
            .ToListAsync(ct);

        return Ok(registrations);
    }

    [HttpPost("api/events/{eventId:guid}/checkin")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<CheckInResponse>> CheckIn(Guid eventId, CheckInRequest request, CancellationToken ct)
    {
        var registration = await db.EventRegistrations
            .SingleOrDefaultAsync(r => r.EventId == eventId && r.UserId == request.UserId, ct);
        if (registration is null)
        {
            return NotFound(new ErrorResponse(new ErrorBody("NOT_REGISTERED", "This user is not registered for the event.")));
        }

        registration.Status = RegistrationStatus.CheckedIn;
        registration.CheckedInAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return Ok(new CheckInResponse(registration.RegistrationId, registration.Status, registration.CheckedInAtUtc!.Value));
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue("sub")!);
}
