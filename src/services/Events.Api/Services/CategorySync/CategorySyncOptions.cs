namespace Events.Api.Services.CategorySync;

public sealed class CategorySyncOptions
{
    public const string SectionName = "CategorySync";

    public required string SyncKey { get; init; }
}
