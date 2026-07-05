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
}
