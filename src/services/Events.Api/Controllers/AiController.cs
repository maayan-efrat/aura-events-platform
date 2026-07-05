using System.Security.Claims;
using System.Text;
using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Events.Api.Services.AI;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
[Route("api/events/ai")]
[Authorize]
public class AiController(EventsDbContext db, IAuraAIService aiService) : ControllerBase
{
    private const int MaxCandidates = 20;

    [HttpPost("recommendations")]
    public async Task<ActionResult<RecommendationsResponse>> GetRecommendations(
        RecommendationsRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var maxResults = Math.Clamp(request.MaxResults, 1, 10);

        var registeredEventIds = await db.EventRegistrations
            .Where(r => r.UserId == userId && r.Status != RegistrationStatus.Cancelled)
            .Select(r => r.EventId)
            .ToListAsync(ct);

        var pastEventTitles = await db.Events
            .Where(e => registeredEventIds.Contains(e.EventId))
            .Select(e => e.Title)
            .ToListAsync(ct);

        var candidates = await db.Events
            .Where(e => e.Status == EventStatus.Published
                        && e.StartAtUtc > DateTimeOffset.UtcNow
                        && !registeredEventIds.Contains(e.EventId))
            .OrderBy(e => e.StartAtUtc)
            .Take(MaxCandidates)
            .Select(e => new { e.EventId, e.Title, e.StartAtUtc, e.VenueName, e.IsVirtual })
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return Ok(new RecommendationsResponse([]));
        }

        var systemPrompt =
            "You are AuraEvents' event recommendation assistant. Recommend events strictly from the " +
            "candidate list provided — never invent an event. Personalize the 'reason' for each pick " +
            "using the user's history and stated preferences. If nothing is genuinely relevant, return fewer items. " +
            "Write each 'reason' in the same language the user wrote their stated preferences in — if they wrote " +
            "in Hebrew, respond in Hebrew, not English. If no preferences were provided, default to Hebrew, since " +
            "this product's UI is Hebrew-first.";

        var userPromptBuilder = new StringBuilder();
        userPromptBuilder.AppendLine($"Return at most {maxResults} recommendations.");
        userPromptBuilder.AppendLine();
        userPromptBuilder.AppendLine("User's past registered events:");
        userPromptBuilder.AppendLine(pastEventTitles.Count > 0
            ? string.Join("\n", pastEventTitles.Select(t => $"- {t}"))
            : "(none yet)");
        userPromptBuilder.AppendLine();
        userPromptBuilder.AppendLine($"User's stated preferences: {request.Preferences ?? "(none provided)"}");
        userPromptBuilder.AppendLine();
        userPromptBuilder.AppendLine("Candidate upcoming events (choose only from these eventId values):");
        foreach (var candidate in candidates)
        {
            var location = candidate.IsVirtual ? "virtual" : candidate.VenueName ?? "in-person";
            userPromptBuilder.AppendLine(
                $"- eventId: {candidate.EventId}, title: \"{candidate.Title}\", starts: {candidate.StartAtUtc:u}, location: {location}");
        }

        var schema = AiSchemas.BuildRecommendationsSchema(candidates.Select(c => c.EventId));

        var aiResult = await aiService.GetStructuredCompletionAsync<AiRecommendationsResult>(
            systemPrompt, userPromptBuilder.ToString(), "event_recommendations", schema, ct);

        var candidatesById = candidates.ToDictionary(c => c.EventId);
        var recommendations = aiResult.Recommendations
            .Where(item => Guid.TryParse(item.EventId, out var id) && candidatesById.ContainsKey(id))
            .Select(item =>
            {
                var candidate = candidatesById[Guid.Parse(item.EventId)];
                return new RecommendedEvent(candidate.EventId, candidate.Title, candidate.StartAtUtc, item.Reason);
            })
            .Take(maxResults)
            .ToList();

        return Ok(new RecommendationsResponse(recommendations));
    }

    [HttpPost("generate-description")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<GenerateDescriptionResponse>> GenerateDescription(
        GenerateDescriptionRequest request, CancellationToken ct)
    {
        if (request.Bullets.Count == 0)
        {
            return BadRequest(new ErrorResponse(new ErrorBody("VALIDATION_ERROR", "At least one bullet point is required.")));
        }

        var systemPrompt =
            "You are AuraEvents' marketing copywriter. Turn an organizer's raw bullet points into a " +
            "polished, factual event description and SEO metadata. Do not invent facts, dates, prices, " +
            "or speakers that were not mentioned in the bullets. Write the summary, description, seoTitle, " +
            "and seoDescription in the same language the organizer used for the event title and bullet " +
            "points below — if they wrote in Hebrew, respond entirely in Hebrew (including SEO fields), " +
            "not English.";

        var tone = string.IsNullOrWhiteSpace(request.Tone) ? "professional and inviting" : request.Tone;
        var userPrompt =
            $"Event title: {request.EventTitle}\n" +
            $"Tone: {tone}\n" +
            "Raw bullet points from the organizer:\n" +
            string.Join("\n", request.Bullets.Select(b => $"- {b}"));

        var schema = AiSchemas.BuildDescriptionSchema();

        var result = await aiService.GetStructuredCompletionAsync<AiGeneratedDescription>(
            systemPrompt, userPrompt, "event_description", schema, ct);

        return Ok(new GenerateDescriptionResponse(result.Summary, result.Description, result.SeoTitle, result.SeoDescription));
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue("sub")!);
}
