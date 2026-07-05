using System.Security.Claims;
using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Events.Api.Services.Umbraco;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
[Route("api/events")]
public class EventsController(
    EventsDbContext db,
    IUmbracoContentService umbracoContent,
    IHostEnvironment env,
    ILogger<EventsController> logger) : ControllerBase
{
    private static readonly string[] ValidStatuses =
        [EventStatus.Draft, EventStatus.Published, EventStatus.Cancelled, EventStatus.Completed];

    private const string UmbracoSyncFailedMessage = "האירוע נוצר אך פרסום התוכן ב-CMS נכשל. ניתן לנסות שוב.";

    [HttpPost]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<EventResponse>> CreateEvent(
        CreateEventRequest request,
        [FromQuery] bool simulateDbFailureAfterUmbracoPublish,
        CancellationToken ct)
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
            Price = request.Price,
            Status = status,
            CreatedByUserId = Guid.Parse(User.FindFirstValue("sub")!),
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync(ct);

        if (request.Content is null)
        {
            return CreatedAtAction(nameof(GetAvailability), new { eventId = @event.EventId }, ToResponse(@event));
        }

        var response = await CreateAndLinkUmbracoContentAsync(@event, request.Content, simulateDbFailureAfterUmbracoPublish, ct);
        return CreatedAtAction(nameof(GetAvailability), new { eventId = @event.EventId }, response);
    }

    [HttpPost("{eventId:guid}/umbraco-content")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<EventResponse>> PublishUmbracoContent(
        Guid eventId,
        EventContentRequest request,
        [FromQuery] bool simulateDbFailureAfterUmbracoPublish,
        CancellationToken ct)
    {
        var @event = await db.Events.SingleOrDefaultAsync(e => e.EventId == eventId, ct);
        if (@event is null)
        {
            return NotFound();
        }

        if (@event.UmbracoContentKey is not null)
        {
            return Conflict(new ErrorResponse(new ErrorBody("CONTENT_ALREADY_LINKED", "This event is already linked to Umbraco content.")));
        }

        var response = await CreateAndLinkUmbracoContentAsync(@event, request, simulateDbFailureAfterUmbracoPublish, ct);
        return Ok(response);
    }

    /// <summary>
    /// Creates+publishes the Umbraco content and links it to <paramref name="event"/>. Two
    /// independent things can fail here, and each needs different cleanup:
    /// (1) the Umbraco call itself (create or publish) — UmbracoContentService already cleans up
    ///     its own half-created draft in that case, so there's nothing left behind in Umbraco.
    /// (2) persisting the resulting UmbracoContentKey in Postgres, *after* Umbraco already
    ///     successfully published the node — without explicit handling this would leave a
    ///     published-but-unlinked node in Umbraco forever, since nothing else references it.
    ///     We delete that node here to avoid the orphan.
    /// </summary>
    private async Task<EventResponse> CreateAndLinkUmbracoContentAsync(
        Event @event,
        EventContentRequest content,
        bool simulateDbFailureAfterUmbracoPublish,
        CancellationToken ct)
    {
        Guid umbracoContentKey;
        try
        {
            umbracoContentKey = await umbracoContent.CreateAndPublishEventPageAsync(@event.EventId, @event.Title, content, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create/publish Umbraco content for event {EventId}", @event.EventId);
            return ToResponse(@event) with { UmbracoSyncError = UmbracoSyncFailedMessage };
        }

        try
        {
            // Test-only seam (see docs/testing/umbraco-swagger-verification.md): lets an
            // integration test force a Postgres failure at the exact point where Umbraco has
            // already published successfully, to verify the cleanup path below. Inert unless the
            // API is actually running in Development.
            if (simulateDbFailureAfterUmbracoPublish && env.IsDevelopment())
            {
                throw new InvalidOperationException(
                    "Simulated DB failure after Umbraco publish (test-only, Development environment).");
            }

            @event.UmbracoContentKey = umbracoContentKey;
            await db.SaveChangesAsync(ct);
            return ToResponse(@event);
        }
        catch (Exception ex)
        {
            @event.UmbracoContentKey = null;
            logger.LogError(ex,
                "Umbraco content {UmbracoContentKey} was published for event {EventId} but linking it in Postgres failed — cleaning it up to avoid an orphaned node.",
                umbracoContentKey, @event.EventId);

            try
            {
                await umbracoContent.DeleteEventPageAsync(umbracoContentKey, ct);
            }
            catch (Exception cleanupEx)
            {
                logger.LogError(cleanupEx,
                    "Failed to clean up Umbraco node {UmbracoContentKey} for event {EventId} after Postgres link failure — manual cleanup required in the backoffice.",
                    umbracoContentKey, @event.EventId);
            }

            return ToResponse(@event) with { UmbracoSyncError = UmbracoSyncFailedMessage };
        }
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
        @event.IsVirtual, @event.Capacity, @event.Price, @event.Status);
}
