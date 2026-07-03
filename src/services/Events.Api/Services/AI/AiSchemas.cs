using System.Text.Json;

namespace Events.Api.Services.AI;

/// <summary>Raw shape returned by the model — only the subjective bits (which candidate, why).
/// Factual fields (title, date) are filled in from our own DB, never trusted from the model.</summary>
public record AiRecommendationItem(string EventId, string Reason);
public record AiRecommendationsResult(List<AiRecommendationItem> Recommendations);

public record AiGeneratedDescription(string Summary, string Description, string SeoTitle, string SeoDescription);

/// <summary>
/// Builds the strict JSON schemas passed as OpenAI Structured Outputs (response_format:
/// json_schema, strict=true). Note strict mode supports only a subset of JSON Schema —
/// no minLength/maxLength/pattern; length/tone constraints are enforced via the prompt text instead.
/// </summary>
public static class AiSchemas
{
    /// <summary>
    /// Constrains "eventId" to an enum of the exact candidate IDs offered, so the model
    /// cannot recommend an event that doesn't exist or wasn't in the candidate set.
    /// </summary>
    public static BinaryData BuildRecommendationsSchema(IEnumerable<Guid> candidateEventIds)
    {
        var schema = new
        {
            type = "object",
            properties = new
            {
                recommendations = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            eventId = new
                            {
                                type = "string",
                                @enum = candidateEventIds.Select(id => id.ToString()).ToArray(),
                            },
                            reason = new
                            {
                                type = "string",
                                description = "One or two sentences, personalized to the user's history/preferences.",
                            },
                        },
                        required = new[] { "eventId", "reason" },
                        additionalProperties = false,
                    },
                },
            },
            required = new[] { "recommendations" },
            additionalProperties = false,
        };

        return BinaryData.FromString(JsonSerializer.Serialize(schema));
    }

    public static BinaryData BuildDescriptionSchema()
    {
        var schema = new
        {
            type = "object",
            properties = new
            {
                summary = new { type = "string", description = "One-sentence teaser, under ~160 characters." },
                description = new { type = "string", description = "Rich marketing description, 2-4 short paragraphs, plain text with blank lines between paragraphs." },
                seoTitle = new { type = "string", description = "SEO title tag, ideally under 60 characters." },
                seoDescription = new { type = "string", description = "SEO meta description, ideally under 160 characters." },
            },
            required = new[] { "summary", "description", "seoTitle", "seoDescription" },
            additionalProperties = false,
        };

        return BinaryData.FromString(JsonSerializer.Serialize(schema));
    }
}
