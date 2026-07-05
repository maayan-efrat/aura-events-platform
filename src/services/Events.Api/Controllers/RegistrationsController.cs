using System.Security.Claims;
using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Events.Api.Services.Qr;
using Events.Api.Services.Umbraco;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
[Authorize]
public class RegistrationsController(
    EventsDbContext db,
    IQrCodeService qrCodeService,
    IUmbracoMediaService umbracoMediaService,
    ILogger<RegistrationsController> logger) : ControllerBase
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
            existing.TicketCode = qrCodeService.GenerateTicketCode();
            existing.QrMediaKey = null;
            existing.QrSyncError = null;
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
                TicketCode = qrCodeService.GenerateTicketCode(),
            };
            db.EventRegistrations.Add(registration);
        }

        await db.SaveChangesAsync(ct);

        // Best-effort archival in Umbraco Media — the registration itself is already committed
        // above and must not fail because of an Umbraco hiccup (mirrors EventsController's
        // UmbracoSyncError pattern for event content publishing).
        string? qrSyncError = null;
        try
        {
            var pngBytes = qrCodeService.GeneratePngBytes(registration.TicketCode);
            registration.QrMediaKey = await umbracoMediaService.UploadTicketQrAsync(registration.RegistrationId, pngBytes, ct);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to archive ticket QR in Umbraco Media for registration {RegistrationId}", registration.RegistrationId);
            qrSyncError = "כרטיס ה-QR נוצר אך גיבויו ב-CMS נכשל.";
        }

        return CreatedAtAction(nameof(Register), new { eventId },
            new RegistrationResponse(registration.RegistrationId, eventId, registration.Status, qrSyncError));
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
            .Select(r => new MyRegistrationResponse(
                r.RegistrationId, r.EventId, r.Event.Title, r.Event.StartAtUtc, r.Event.EndAtUtc, r.Event.Timezone,
                r.Status, r.RegisteredAtUtc, r.TicketCode))
            .ToListAsync(ct);

        return Ok(registrations);
    }

    [HttpGet("api/events/{eventId:guid}/registrations/me/qr")]
    public async Task<IActionResult> GetMyTicketQr(Guid eventId, CancellationToken ct)
    {
        var userId = GetUserId();

        var registration = await db.EventRegistrations
            .SingleOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId, ct);
        if (registration is null)
        {
            return NotFound();
        }

        return TicketQrImageResult(registration);
    }

    [HttpGet("api/events/{eventId:guid}/registrations/{registrationId:guid}/qr")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<IActionResult> GetTicketQr(Guid eventId, Guid registrationId, CancellationToken ct)
    {
        var registration = await db.EventRegistrations
            .SingleOrDefaultAsync(r => r.EventId == eventId && r.RegistrationId == registrationId, ct);
        if (registration is null)
        {
            return NotFound();
        }

        return TicketQrImageResult(registration);
    }

    /// <summary>
    /// The PNG is regenerated on demand from the stored TicketCode rather than read back from
    /// Umbraco Media — it's fully deterministic, so display never depends on Umbraco being up.
    /// </summary>
    private IActionResult TicketQrImageResult(EventRegistration registration)
    {
        if (registration.Status == RegistrationStatus.Cancelled)
        {
            Response.Headers.CacheControl = "no-store";
            return StatusCode(StatusCodes.Status410Gone,
                new ErrorResponse(new ErrorBody("TICKET_CANCELLED", "This registration was cancelled; its ticket is no longer valid.")));
        }

        // TicketCode is an opaque random token that never changes while the ticket is valid, so
        // the rendered PNG for a given code is immutable — safe to let the browser skip
        // re-fetching/regenerating it on every page refresh.
        Response.Headers.CacheControl = "private, max-age=86400, immutable";
        Response.Headers.ETag = $"\"{registration.TicketCode}\"";
        return File(qrCodeService.GeneratePngBytes(registration.TicketCode), "image/png");
    }

    [HttpGet("api/events/{eventId:guid}/registrations/tickets/manifest")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<IEnumerable<TicketManifestEntry>>> GetTicketManifest(Guid eventId, CancellationToken ct)
    {
        var manifest = await db.EventRegistrations
            .Where(r => r.EventId == eventId && r.Status != RegistrationStatus.Cancelled)
            .Select(r => new TicketManifestEntry(r.RegistrationId, r.TicketCode, r.UserId, r.Status))
            .ToListAsync(ct);

        return Ok(manifest);
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

    /// <summary>
    /// Check-in by scanned/pasted ticket code — the counterpart to <see cref="CheckIn"/> (which
    /// requires already knowing the attendee's UserId) for an organizer who only has whatever the
    /// QR/manifest gave them: the TicketCode.
    /// </summary>
    [HttpPost("api/events/{eventId:guid}/checkin/by-ticket-code")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<CheckInResponse>> CheckInByTicketCode(Guid eventId, CheckInByTicketCodeRequest request, CancellationToken ct)
    {
        var registration = await db.EventRegistrations
            .SingleOrDefaultAsync(r => r.EventId == eventId && r.TicketCode == request.TicketCode, ct);
        if (registration is null)
        {
            return NotFound(new ErrorResponse(new ErrorBody("TICKET_NOT_FOUND", "No registration for this event matches that ticket code.")));
        }

        if (registration.Status == RegistrationStatus.Cancelled)
        {
            return StatusCode(StatusCodes.Status410Gone,
                new ErrorResponse(new ErrorBody("TICKET_CANCELLED", "This registration was cancelled; its ticket is no longer valid.")));
        }

        registration.Status = RegistrationStatus.CheckedIn;
        registration.CheckedInAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return Ok(new CheckInResponse(registration.RegistrationId, registration.Status, registration.CheckedInAtUtc!.Value));
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue("sub")!);
}
