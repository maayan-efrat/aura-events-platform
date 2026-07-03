using System.Text.Json;
using OpenAI.Chat;

namespace Events.Api.Services.AI;

public class AuraAIService : IAuraAIService
{
    private static readonly JsonSerializerOptions DeserializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ChatClient _chatClient;
    private readonly ILogger<AuraAIService> _logger;

    public AuraAIService(OpenAIOptions options, ILogger<AuraAIService> logger)
    {
        _chatClient = new ChatClient(model: options.Model, apiKey: options.ApiKey);
        _logger = logger;
    }

    public async Task<TResult> GetStructuredCompletionAsync<TResult>(
        string systemPrompt,
        string userPrompt,
        string schemaName,
        BinaryData jsonSchema,
        CancellationToken ct)
    {
        var completionOptions = new ChatCompletionOptions
        {
            ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                jsonSchemaFormatName: schemaName,
                jsonSchema: jsonSchema,
                jsonSchemaIsStrict: true),
        };

        ChatCompletion completion;
        try
        {
            completion = await _chatClient.CompleteChatAsync(
                messages: [new SystemChatMessage(systemPrompt), new UserChatMessage(userPrompt)],
                options: completionOptions,
                cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI chat completion request failed for schema {SchemaName}", schemaName);
            throw;
        }

        if (completion.FinishReason != ChatFinishReason.Stop || completion.Content.Count == 0)
        {
            throw new InvalidOperationException(
                $"OpenAI completion for schema '{schemaName}' did not finish normally (FinishReason={completion.FinishReason}).");
        }

        var json = completion.Content[0].Text;
        return JsonSerializer.Deserialize<TResult>(json, DeserializeOptions)
            ?? throw new InvalidOperationException($"OpenAI returned an empty/unparseable result for schema '{schemaName}'.");
    }
}
