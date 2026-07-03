namespace Events.Api.Services.AI;

public sealed class OpenAIOptions
{
    public const string SectionName = "OpenAI";

    public required string ApiKey { get; init; }
    public string Model { get; init; } = "gpt-4o-mini";
}
