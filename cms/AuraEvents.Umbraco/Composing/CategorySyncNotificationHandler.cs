using AuraEvents.Umbraco.Services.EventsApiSync;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;

namespace AuraEvents.Umbraco.Composing;

public class CategorySyncComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddSingleton(builder.Config.GetSection(EventsApiSyncOptions.SectionName).Get<EventsApiSyncOptions>()
            ?? throw new InvalidOperationException($"Missing '{EventsApiSyncOptions.SectionName}' configuration section."));

        builder.Services.AddHttpClient<CategorySyncClient>((sp, client) =>
        {
            var options = sp.GetRequiredService<EventsApiSyncOptions>();
            client.BaseAddress = new Uri(options.BaseUrl);
        });

        builder.AddNotificationAsyncHandler<ContentPublishedNotification, CategoryPublishSyncHandler>();
        builder.AddNotificationAsyncHandler<ContentUnpublishedNotification, CategoryUnpublishSyncHandler>();
        builder.AddNotificationAsyncHandler<ContentDeletedNotification, CategoryDeleteSyncHandler>();
    }
}

/// <summary>
/// Mirrors published "categoryItem" nodes into Events.Api's Postgres "categories" table via
/// CategorySyncClient. A branch publish (parent + children published together) fires one
/// notification carrying every affected entity, in no guaranteed order — sorting by Level
/// ascending and awaiting each sync call in turn ensures a parent's row always exists in Postgres
/// before its children's, avoiding a foreign-key failure on parent_id (Postgres's
/// DEFERRABLE INITIALLY DEFERRED FK is the remaining safety net for anything this ordering misses).
/// </summary>
public class CategoryPublishSyncHandler(CategorySyncClient syncClient, IContentService contentService)
    : INotificationAsyncHandler<ContentPublishedNotification>
{
    private const string ItemAlias = "categoryItem";

    public async Task HandleAsync(ContentPublishedNotification notification, CancellationToken cancellationToken)
    {
        var categoryItems = notification.PublishedEntities
            .Where(c => c.ContentType.Alias == ItemAlias)
            .OrderBy(c => c.Level);

        foreach (var content in categoryItems)
        {
            var parentId = ResolveParentCategoryId(content);
            await syncClient.SyncPublishedAsync(content.Key, content.Name ?? string.Empty, parentId, cancellationToken);
        }
    }

    private Guid? ResolveParentCategoryId(IContent content)
    {
        var parent = contentService.GetById(content.ParentId);
        return parent is not null && parent.ContentType.Alias == ItemAlias ? parent.Key : null;
    }
}

/// <summary>
/// Unpublishing a category should stop it (and its descendants) from being offered for
/// filtering/tagging without deleting the Postgres row outright — same soft-delete/cascade
/// endpoint as an actual delete (see CategoryDeleteSyncHandler).
/// </summary>
public class CategoryUnpublishSyncHandler(CategorySyncClient syncClient) : INotificationAsyncHandler<ContentUnpublishedNotification>
{
    private const string ItemAlias = "categoryItem";

    public async Task HandleAsync(ContentUnpublishedNotification notification, CancellationToken cancellationToken)
    {
        foreach (var content in notification.UnpublishedEntities.Where(c => c.ContentType.Alias == ItemAlias))
        {
            await syncClient.SyncDeletedAsync(content.Key, cancellationToken);
        }
    }
}

/// <summary>
/// A branch delete in Umbraco is not guaranteed to notify for every descendant individually, so
/// this only calls the sync endpoint for the entities actually present in the notification —
/// Events.Api's DELETE endpoint cascades to descendants itself via a recursive query over the
/// parent_id chain it already has in Postgres.
/// </summary>
public class CategoryDeleteSyncHandler(CategorySyncClient syncClient) : INotificationAsyncHandler<ContentDeletedNotification>
{
    private const string ItemAlias = "categoryItem";

    public async Task HandleAsync(ContentDeletedNotification notification, CancellationToken cancellationToken)
    {
        foreach (var content in notification.DeletedEntities.Where(c => c.ContentType.Alias == ItemAlias))
        {
            await syncClient.SyncDeletedAsync(content.Key, cancellationToken);
        }
    }
}
