using System.Security.Claims;
using System.Text.Json;
using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
public class AnalyticsController(EventsDbContext db) : ControllerBase
{
    [HttpPost("api/events/analytics/track")]
    [AllowAnonymous]
    public async Task<IActionResult> Track(TrackRequest request, CancellationToken ct)
    {
        var entry = new EventTrackingLog
        {
            EventId = request.EventId,
            AnonymousId = request.AnonymousId,
            SessionId = request.SessionId,
            EventType = request.EventType,
            MetadataJson = request.Metadata is null ? null : JsonSerializer.Serialize(request.Metadata),
            OccurredAtUtc = DateTimeOffset.UtcNow,
        };

        if (User.Identity?.IsAuthenticated == true)
        {
            entry.UserId = Guid.Parse(User.FindFirstValue("sub")!);
        }

        db.EventTrackingLog.Add(entry);
        await db.SaveChangesAsync(ct);

        return Accepted();
    }

    [HttpGet("api/events/{eventId:guid}/analytics/summary")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<AnalyticsSummaryResponse>> GetSummary(Guid eventId, CancellationToken ct)
    {
        var pageViews = await db.EventTrackingLog.CountAsync(t => t.EventId == eventId && t.EventType == "PageView", ct);
        var registerClicks = await db.EventTrackingLog.CountAsync(t => t.EventId == eventId && t.EventType == "RegisterClick", ct);
        var registrationsCompleted = await db.EventRegistrations
            .CountAsync(r => r.EventId == eventId && (r.Status == RegistrationStatus.Registered || r.Status == RegistrationStatus.CheckedIn), ct);
        var checkIns = await db.EventRegistrations.CountAsync(r => r.EventId == eventId && r.Status == RegistrationStatus.CheckedIn, ct);

        var conversionRate = pageViews == 0 ? 0 : Math.Round((double)registrationsCompleted / pageViews, 2);

        return Ok(new AnalyticsSummaryResponse(eventId, pageViews, registerClicks, registrationsCompleted, checkIns, conversionRate));
    }
}
