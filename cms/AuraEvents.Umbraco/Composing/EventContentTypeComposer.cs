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
/// checks for the alias before creating, so this is safe to run on every startup. Also seeds
/// one demo eventPage node linked to a real Events.Api record, so the homepage has something to render.
/// </summary>
public class EnsureEventPageContentTypeHandler(
    IContentTypeService contentTypeService,
    IContentService contentService,
    IShortStringHelper shortStringHelper)
    : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    private const string Alias = "eventPage";

    // Matches the Events.Api record created for the "AuraEvents Launch Night" demo event.
    private const string DemoSystemEventId = "97cb325e-266f-41a9-9623-83bbecd5c361";

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        if (contentTypeService.Get(Alias) is null)
        {
            var contentType = new ContentType(shortStringHelper, -1)
            {
                Alias = Alias,
                Name = "Event Page",
                Icon = "icon-calendar",
                AllowedAsRoot = true,
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
            };

            var propertyGroup = new PropertyGroup(new PropertyTypeCollection(false, properties))
            {
                Name = "Content",
                Alias = "content",
            };

            contentType.PropertyGroups = new PropertyGroupCollection([propertyGroup]);

            await contentTypeService.CreateAsync(contentType, Constants.Security.SuperUserKey);
        }

        var alreadySeeded = contentService.GetRootContent()
            .Any(c => c.ContentType.Alias == Alias && c.GetValue<string>("systemEventId") == DemoSystemEventId);
        if (alreadySeeded)
        {
            return;
        }

        var demoContent = contentService.Create("AuraEvents Launch Night", -1, Alias);
        demoContent.SetValue("systemEventId", DemoSystemEventId);
        demoContent.SetValue("summary", "Join us for the official AuraEvents launch — an evening of demos, talks, and networking in Tel Aviv.");
        demoContent.SetValue("description", "Come celebrate the launch of AuraEvents with the team behind it. Expect live product demos, short talks from the founders, and plenty of time to meet other early adopters.");
        contentService.Save(demoContent);
        contentService.Publish(demoContent, ["*"]);
    }
}
