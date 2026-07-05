namespace Events.Api.Services.Umbraco;

public sealed class UmbracoOptions
{
    public const string SectionName = "Umbraco";

    public required string BaseUrl { get; init; }
    public required string ClientId { get; init; }
    public required string ClientSecret { get; init; }
    public required Guid EventPageDocumentTypeKey { get; init; }
    public required Guid EventsRootFolderKey { get; init; }
    public required Guid CategoryItemDocumentTypeKey { get; init; }
    public required Guid CategoriesRootFolderKey { get; init; }
}
