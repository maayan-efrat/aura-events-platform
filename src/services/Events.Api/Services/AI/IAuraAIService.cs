namespace Events.Api.Services.AI;

/// <summary>
/// Thin wrapper around the OpenAI Chat Completions API using Structured Outputs
/// (strict JSON-schema mode) so callers get a strongly-typed, schema-conformant
/// result instead of free-form text to parse.
/// </summary>
public interface IAuraAIService
{
    Task<TResult> GetStructuredCompletionAsync<TResult>(
        string systemPrompt,
        string userPrompt,
        string schemaName,
        BinaryData jsonSchema,
        CancellationToken ct);
}
