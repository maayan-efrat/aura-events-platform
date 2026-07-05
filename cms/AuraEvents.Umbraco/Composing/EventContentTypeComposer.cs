using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;

namespace AuraEvents.Umbraco.Composing;

public class EventContentTypeComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, EnsureEventPageContentTypeHandler>();
    }
}

/// <summary>
/// Creates the "eventPage" content type on first boot if it doesn't already exist — see
/// docs/architecture/01-system-architecture.md §3.1 for the full field rationale. Idempotent:
/// checks for the alias before creating, so this is safe to run on every startup. Also creates an
/// "eventsFolder" container (so eventPage nodes live under a single "Events" folder in the
/// backoffice tree rather than scattered at content root, mirroring how categories get their own
/// "Categories" folder — see CategoryContentTypeComposer), and seeds one demo eventPage node
/// linked to a real Events.Api record, so the homepage has something to render.
/// </summary>
public class EnsureEventPageContentTypeHandler(
    IContentTypeService contentTypeService,
    IContentService contentService,
    IShortStringHelper shortStringHelper)
    : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    private const string Alias = "eventPage";
    private const string FolderAlias = "eventsFolder";
    private const string FolderName = "Events";

    // Matches the Events.Api record created for the "AuraEvents Launch Night" demo event.
    private const string DemoSystemEventId = "97cb325e-266f-41a9-9623-83bbecd5c361";

    // Fixed so Events.Api can address this content type without a runtime lookup call — must
    // match Umbraco:EventPageDocumentTypeKey in Events.Api's config (see docker-compose.yml).
    private static readonly Guid EventPageDocumentTypeKey = Guid.Parse("d2fa55b7-53fe-49b4-96dc-fdcb95bad0c4");
    private static readonly Guid EventsFolderContentTypeKey = Guid.Parse("3f7f9c1e-2b8a-4a5d-9b0e-6c1d8a2f4e9b");

    // Fixed so Events.Api can pass this directly as the `parent` when creating new eventPage
    // documents (see UmbracoContentService.CreateAndPublishEventPageAsync) — must match
    // Umbraco:EventsRootFolderKey in Events.Api's config (see docker-compose.yml). Same
    // environment-specific gotcha as EventPageDocumentTypeKey: only applies as-is on a database
    // where this folder gets created fresh with this key.
    private static readonly Guid EventsRootFolderKey = Guid.Parse("8a3c9f2d-1e6b-4d7a-8c5f-2b9e6a1d3f7c");

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        if (contentTypeService.Get(Alias) is null)
        {
            var contentType = new ContentType(shortStringHelper, -1)
            {
                Key = EventPageDocumentTypeKey,
                Alias = Alias,
                Name = "Event Page",
                Icon = "icon-calendar",
                AllowedAsRoot = false,
                IsElement = false,
            };

            var properties = new List<PropertyType>
            {
                new(shortStringHelper, Constants.PropertyEditors.Aliases.TextBox, ValueStorageType.Nvarchar, "systemEventId")
                {
                    Name = "System Event Id",
                    Mandatory = true,
                    Description = "Links this content to its transactional record in Events.Api (Events.EventId) — must match exactly.",
                },
                new(shortStringHelper, Constants.PropertyEditors.Aliases.TextBox, ValueStorageType.Nvarchar, "summary")
                {
                    Name = "Summary",
                    Description = "One-sentence teaser shown on the event listing card.",
                },
                new(shortStringHelper, Constants.PropertyEditors.Aliases.TextArea, ValueStorageType.Ntext, "description")
                {
                    Name = "Description",
                    Description = "Full marketing description shown on the event detail page.",
                },
                new(shortStringHelper, Constants.PropertyEditors.Aliases.TextBox, ValueStorageType.Nvarchar, "seoTitle")
                {
                    Name = "SEO Title",
                },
                new(shortStringHelper, Constants.PropertyEditors.Aliases.TextArea, ValueStorageType.Ntext, "seoDescription")
                {
                    Name = "SEO Description",
                },
                new(shortStringHelper, Constants.PropertyEditors.Aliases.MediaPicker3, ValueStorageType.Ntext, "heroImage")
                {
                    Name = "Hero Image",
                    Description = "Main image shown on the event listing card and detail page.",
                },
            };

            var propertyGroup = new PropertyGroup(new PropertyTypeCollection(false, properties))
            {
                Name = "Content",
                Alias = "content",
            };

            contentType.PropertyGroups = new PropertyGroupCollection([propertyGroup]);

            await contentTypeService.CreateAsync(contentType, Constants.Security.SuperUserKey);
        }
        else
        {
            var existingEventPageType = contentTypeService.Get(Alias)!;
            var needsUpdate = false;

            // Environments provisioned before the "Events" folder existed have eventPage created
            // with AllowedAsRoot = true — flip it so new nodes can no longer be created loose at
            // content root, without needing a fresh database.
            if (existingEventPageType.AllowedAsRoot)
            {
                existingEventPageType.AllowedAsRoot = false;
                needsUpdate = true;
            }

            // Environments provisioned before the hero image field existed are missing it —
            // add it to the existing "content" property group rather than requiring a fresh database.
            if (!existingEventPageType.PropertyTypes.Any(p => p.Alias == "heroImage"))
            {
                var heroImageProperty = new PropertyType(shortStringHelper, Constants.PropertyEditors.Aliases.MediaPicker3, ValueStorageType.Ntext, "heroImage")
                {
                    Name = "Hero Image",
                    Description = "Main image shown on the event listing card and detail page.",
                };
                existingEventPageType.AddPropertyType(heroImageProperty, "content", "Content");
                needsUpdate = true;
            }

            if (needsUpdate)
            {
                await contentTypeService.UpdateAsync(existingEventPageType, Constants.Security.SuperUserKey);
            }
        }

        if (contentTypeService.Get(FolderAlias) is null)
        {
            var folderType = new ContentType(shortStringHelper, -1)
            {
                Key = EventsFolderContentTypeKey,
                Alias = FolderAlias,
                Name = "Events Folder",
                Icon = "icon-folder",
                AllowedAsRoot = true,
                IsElement = false,
                AllowedContentTypes = [new ContentTypeSort(EventPageDocumentTypeKey, 0, Alias)],
            };

            await contentTypeService.CreateAsync(folderType, Constants.Security.SuperUserKey);
        }

        var eventsFolder = contentService.GetById(EventsRootFolderKey);
        if (eventsFolder is null)
        {
            eventsFolder = contentService.Create(FolderName, -1, FolderAlias);
            eventsFolder.Key = EventsRootFolderKey;
            contentService.Save(eventsFolder);
            contentService.Publish(eventsFolder, ["*"]);
        }

        // Checks both content root (pre-existing environments, before this folder existed) and
        // the new Events folder (fresh environments, or this environment after its demo node gets
        // moved in) — avoids seeding a second demo node in an already-provisioned database where
        // the original one still sits at root.
        var alreadySeeded = contentService.GetRootContent().Any(MatchesDemoEvent)
            || contentService.GetPagedChildren(eventsFolder.Id, 0, 500, out _, propertyAliases: null, filter: null, ordering: null, loadTemplates: false)
                .Any(MatchesDemoEvent);
        if (alreadySeeded)
        {
            return;
        }

        var demoContent = contentService.Create("AuraEvents Launch Night", EventsRootFolderKey, Alias);
        demoContent.SetValue("systemEventId", DemoSystemEventId);
        demoContent.SetValue("summary", "Join us for the official AuraEvents launch — an evening of demos, talks, and networking in Tel Aviv.");
        demoContent.SetValue("description", "Come celebrate the launch of AuraEvents with the team behind it. Expect live product demos, short talks from the founders, and plenty of time to meet other early adopters.");
        contentService.Save(demoContent);
        contentService.Publish(demoContent, ["*"]);
    }

    private static bool MatchesDemoEvent(IContent c) =>
        c.ContentType.Alias == Alias && c.GetValue<string>("systemEventId") == DemoSystemEventId;
}
