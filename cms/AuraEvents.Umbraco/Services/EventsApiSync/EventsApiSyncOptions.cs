namespace AuraEvents.Umbraco.Services.EventsApiSync;

public sealed class EventsApiSyncOptions
{
    public const string SectionName = "EventsApiSync";

    public required string BaseUrl { get; init; }
    public required string SyncKey { get; init; }
}
