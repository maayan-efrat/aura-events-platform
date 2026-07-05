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

        var categoryIds = request.CategoryIds ?? [];
        var validCategoryIds = await db.Categories
            .Where(c => c.IsActive && categoryIds.Contains(c.CategoryId))
            .Select(c => c.CategoryId)
            .ToListAsync(ct);
        if (validCategoryIds.Count != categoryIds.Distinct().Count())
        {
            return BadRequest(new ErrorResponse(new ErrorBody("VALIDATION_ERROR", "One or more categoryIds are unknown or inactive.")));
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
        foreach (var categoryId in validCategoryIds)
        {
            db.EventCategories.Add(new EventCategory { EventId = @event.EventId, CategoryId = categoryId });
        }

        await db.SaveChangesAsync(ct);

        if (request.Content is null)
        {
            return CreatedAtAction(nameof(GetAvailability), new { eventId = @event.EventId }, await ToResponseAsync(@event, ct));
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
            return (await ToResponseAsync(@event, ct)) with { UmbracoSyncError = UmbracoSyncFailedMessage };
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
            return await ToResponseAsync(@event, ct);
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

            return (await ToResponseAsync(@event, ct)) with { UmbracoSyncError = UmbracoSyncFailedMessage };
        }
    }

    /// <summary>
    /// Fast category filter for the public listing page: a single Postgres join over
    /// event_categories rather than a per-category call out to Umbraco — see the category-sync
    /// design rationale on <see cref="Entities.Category"/>.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<EventResponse>>> GetEvents([FromQuery] Guid? categoryId, CancellationToken ct)
    {
        var eventsQuery = db.Events.AsQueryable();
        if (categoryId is not null)
        {
            eventsQuery = eventsQuery.Where(e => e.EventCategories.Any(ec => ec.CategoryId == categoryId));
        }

        var events = await eventsQuery.ToListAsync(ct);
        var eventIds = events.Select(e => e.EventId).ToList();

        var categoriesByEvent = (await db.EventCategories
            .Where(ec => eventIds.Contains(ec.EventId))
            .Select(ec => new { ec.EventId, Category = new CategoryRef(ec.CategoryId, ec.Category.Name) })
            .ToListAsync(ct))
            .ToLookup(x => x.EventId, x => x.Category);

        var responses = events.Select(e => new EventResponse(
            e.EventId, e.UmbracoContentKey, e.Slug, e.Title, e.StartAtUtc, e.EndAtUtc, e.Timezone,
            e.VenueName, e.IsVirtual, e.Capacity, e.Price, e.Status, categoriesByEvent[e.EventId].ToList())).ToList();

        return Ok(responses);
    }

    /// <summary>Events the current user created — powers the "my events" edit list on the dashboard.</summary>
    [HttpGet("/api/users/me/events")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<List<EventResponse>>> GetMyEvents(CancellationToken ct)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue("sub")!);
        var events = await db.Events
            .Where(e => e.CreatedByUserId == currentUserId)
            .OrderByDescending(e => e.CreatedAtUtc)
            .ToListAsync(ct);

        var responses = new List<EventResponse>();
        foreach (var e in events)
        {
            responses.Add(await ToResponseAsync(e, ct));
        }

        return Ok(responses);
    }

    [HttpGet("{eventId:guid}")]
    public async Task<ActionResult<EventResponse>> GetById(Guid eventId, CancellationToken ct)
    {
        var @event = await db.Events.SingleOrDefaultAsync(e => e.EventId == eventId, ct);
        if (@event is null)
        {
            return NotFound();
        }

        return Ok(await ToResponseAsync(@event, ct));
    }

    /// <summary>
    /// Lets the organizer who created the event (or an Admin) edit its logistics — dates, venue,
    /// capacity, price, status, categories. Title/slug/editorial content are Umbraco's domain
    /// (see docs/architecture/01-system-architecture.md §3.1) and aren't editable here.
    /// </summary>
    [HttpPut("{eventId:guid}")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<EventResponse>> UpdateEvent(Guid eventId, UpdateEventRequest request, CancellationToken ct)
    {
        var @event = await db.Events.SingleOrDefaultAsync(e => e.EventId == eventId, ct);
        if (@event is null)
        {
            return NotFound();
        }

        var currentUserId = Guid.Parse(User.FindFirstValue("sub")!);
        if (@event.CreatedByUserId != currentUserId && !User.IsInRole("Admin"))
        {
            return Forbid();
        }

        var status = string.IsNullOrWhiteSpace(request.Status) ? @event.Status : request.Status;
        if (!ValidStatuses.Contains(status))
        {
            return BadRequest(new ErrorResponse(new ErrorBody("VALIDATION_ERROR", $"Status must be one of: {string.Join(", ", ValidStatuses)}.")));
        }

        var categoryIds = request.CategoryIds ?? [];
        var validCategoryIds = await db.Categories
            .Where(c => c.IsActive && categoryIds.Contains(c.CategoryId))
            .Select(c => c.CategoryId)
            .ToListAsync(ct);
        if (validCategoryIds.Count != categoryIds.Distinct().Count())
        {
            return BadRequest(new ErrorResponse(new ErrorBody("VALIDATION_ERROR", "One or more categoryIds are unknown or inactive.")));
        }

        @event.StartAtUtc = request.StartAtUtc;
        @event.EndAtUtc = request.EndAtUtc;
        @event.Timezone = request.Timezone;
        @event.VenueName = request.VenueName;
        @event.IsVirtual = request.IsVirtual;
        @event.Capacity = request.Capacity;
        @event.Price = request.Price;
        @event.Status = status;
        @event.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var existingLinks = await db.EventCategories.Where(ec => ec.EventId == eventId).ToListAsync(ct);
        db.EventCategories.RemoveRange(existingLinks);
        foreach (var categoryId in validCategoryIds)
        {
            db.EventCategories.Add(new EventCategory { EventId = eventId, CategoryId = categoryId });
        }

        await db.SaveChangesAsync(ct);
        return Ok(await ToResponseAsync(@event, ct));
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

    private async Task<EventResponse> ToResponseAsync(Event @event, CancellationToken ct)
    {
        var categories = await db.EventCategories
            .Where(ec => ec.EventId == @event.EventId)
            .Select(ec => new CategoryRef(ec.CategoryId, ec.Category.Name))
            .ToListAsync(ct);

        return new(
            @event.EventId, @event.UmbracoContentKey, @event.Slug, @event.Title,
            @event.StartAtUtc, @event.EndAtUtc, @event.Timezone, @event.VenueName,
            @event.IsVirtual, @event.Capacity, @event.Price, @event.Status, categories);
    }
}
