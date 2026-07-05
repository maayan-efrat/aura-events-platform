using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;

namespace AuraEvents.Umbraco.Composing;

public class CategoryContentTypeComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, EnsureCategoryContentTypesHandler>();
    }
}

/// <summary>
/// Creates the "categoryFolder" and "categoryItem" content types on first boot if they don't
/// already exist, and seeds one root "Categories" folder. Umbraco is the source of truth for the
/// category tree; CategorySyncNotificationHandler mirrors it into Events.Api's Postgres for fast
/// filtering. Idempotent: checks for each alias before creating, so this is safe to run on every
/// startup, matching EventContentTypeComposer's pattern.
/// </summary>
public class EnsureCategoryContentTypesHandler(
    IContentTypeService contentTypeService,
    IContentService contentService,
    IShortStringHelper shortStringHelper)
    : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    private const string FolderAlias = "categoryFolder";
    private const string ItemAlias = "categoryItem";
    private const string RootFolderName = "Categories";

    // Fixed so Events.Api / the sync handler can address these content types without a runtime
    // lookup call — must match any config that references them (none currently do, unlike
    // eventPage, since the sync handler only needs the alias to filter notifications).
    private static readonly Guid CategoryFolderContentTypeKey = Guid.Parse("6a2a6e3a-9b3d-4c9a-8e7e-6b6c9a2b6a0f");
    private static readonly Guid CategoryItemContentTypeKey = Guid.Parse("b7f0a9d1-6e2b-4a3c-9e7d-6f5f9d8c1a2b");

    // Fixed so Events.Api can pass this directly as the `parent` when creating a new top-level
    // categoryItem from the frontend (see UmbracoContentService.CreateAndPublishCategoryAsync) —
    // must match Umbraco:CategoriesRootFolderKey in Events.Api's config (see docker-compose.yml).
    private static readonly Guid CategoriesRootFolderKey = Guid.Parse("4d8b6e2a-7c1f-4b9d-8e3a-5f2c9d1b6a4e");

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        await EnsureCategoryItemContentTypeAsync();
        await EnsureCategoryFolderContentTypeAsync();
        EnsureRootCategoriesFolder();
    }

    private async Task EnsureCategoryItemContentTypeAsync()
    {
        if (contentTypeService.Get(ItemAlias) is not null)
        {
            return;
        }

        var contentType = new ContentType(shortStringHelper, -1)
        {
            Key = CategoryItemContentTypeKey,
            Alias = ItemAlias,
            Name = "Category Item",
            Icon = "icon-tags",
            AllowedAsRoot = false,
            IsElement = false,
        };

        var properties = new List<PropertyType>
        {
            new(shortStringHelper, Constants.PropertyEditors.Aliases.TextArea, ValueStorageType.Ntext, "description")
            {
                Name = "Description",
                Description = "Optional short description shown in the backoffice — editorial only, never synced to Postgres.",
            },
        };

        var propertyGroup = new PropertyGroup(new PropertyTypeCollection(false, properties))
        {
            Name = "Content",
            Alias = "content",
        };

        contentType.PropertyGroups = new PropertyGroupCollection([propertyGroup]);

        await contentTypeService.CreateAsync(contentType, Constants.Security.SuperUserKey);

        // categoryItem is allowed under itself so editors can nest sub-categories (arbitrary tree
        // depth). This must be a follow-up update, not set before the initial CreateAsync above —
        // a self-reference to the type's own (not-yet-persisted) key is silently dropped if set
        // inline during creation (confirmed against this project's own running Umbraco 17
        // instance: the create call succeeds either way, but GET /document-type/{id} afterwards
        // shows an empty allowedDocumentTypes unless this second call is made).
        contentType.AllowedContentTypes = [new ContentTypeSort(CategoryItemContentTypeKey, 0, ItemAlias)];
        await contentTypeService.UpdateAsync(contentType, Constants.Security.SuperUserKey);
    }

    private async Task EnsureCategoryFolderContentTypeAsync()
    {
        if (contentTypeService.Get(FolderAlias) is not null)
        {
            return;
        }

        var contentType = new ContentType(shortStringHelper, -1)
        {
            Key = CategoryFolderContentTypeKey,
            Alias = FolderAlias,
            Name = "Category Folder",
            Icon = "icon-folder",
            AllowedAsRoot = true,
            IsElement = false,
            AllowedContentTypes = [new ContentTypeSort(CategoryItemContentTypeKey, 0, ItemAlias)],
        };

        await contentTypeService.CreateAsync(contentType, Constants.Security.SuperUserKey);
    }

    private void EnsureRootCategoriesFolder()
    {
        // Same environment-specific gotcha as EventPageDocumentTypeKey (see
        // EventContentTypeComposer): this fixed key only takes effect the first time the folder
        // is created. A database provisioned before this fix already has a "Categories" folder
        // with some other (auto-generated) key, so Events.Api needs
        // Umbraco:CategoriesRootFolderKey overridden to match it there — see docker-compose.yml.
        if (contentService.GetById(CategoriesRootFolderKey) is not null
            || contentService.GetRootContent().Any(c => c.ContentType.Alias == FolderAlias && c.Name == RootFolderName))
        {
            return;
        }

        var rootFolder = contentService.Create(RootFolderName, -1, FolderAlias);
        rootFolder.Key = CategoriesRootFolderKey;
        contentService.Save(rootFolder);
        contentService.Publish(rootFolder, ["*"]);
    }
}
