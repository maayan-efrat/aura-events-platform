using Events.Api.Dtos;

namespace Events.Api.Services.Umbraco;

public interface IUmbracoContentService
{
    /// <summary>
    /// Creates and publishes an "eventPage" document in Umbraco with <paramref name="eventId"/>
    /// written into its systemEventId property. Returns the new document's own key — this is
    /// what gets stored as Event.UmbracoContentKey (distinct from eventId itself).
    /// </summary>
    Task<Guid> CreateAndPublishEventPageAsync(Guid eventId, string title, EventContentRequest content, CancellationToken ct);

    /// <summary>
    /// Deletes a previously created eventPage document (draft or published). Callers use this to
    /// clean up a node that Umbraco successfully created/published but that a later step (e.g.
    /// persisting UmbracoContentKey in Postgres) failed to link, so it doesn't linger orphaned.
    /// </summary>
    Task DeleteEventPageAsync(Guid documentId, CancellationToken ct);

    /// <summary>
    /// Creates and publishes a "categoryItem" document in Umbraco — lets an organizer/admin add a
    /// new category directly from the event-creation form rather than only via the backoffice.
    /// Umbraco stays the source of truth for the tree either way: CategorySyncNotificationHandler
    /// (in the CMS project) picks up this publish the same as any backoffice-created category and
    /// mirrors it into Postgres, so there's still exactly one path that keeps Postgres in sync.
    /// </summary>
    Task<Guid> CreateAndPublishCategoryAsync(string name, Guid? parentId, CancellationToken ct);

    /// <summary>
    /// Replaces the "heroImage" property on an already-published eventPage and republishes.
    /// Fetches the document's current values/variants first and resends them unchanged alongside
    /// the new image — PUT /document/{id} is a full replace, so anything omitted would be wiped.
    /// </summary>
    Task UpdateHeroImageAsync(Guid documentId, byte[] imageBytes, string fileName, string contentType, CancellationToken ct);
}
