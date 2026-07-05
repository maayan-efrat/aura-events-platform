namespace Events.Api.Services.Umbraco;

/// <summary>
/// Thrown when creating/publishing an eventPage document in Umbraco fails. If cleanup of an
/// already-created-but-unpublished draft also failed, <see cref="OrphanedDocumentId"/> carries
/// the document id so it can be removed manually from the Umbraco backoffice.
/// </summary>
public sealed class UmbracoPublishException(string message, Guid? orphanedDocumentId = null, Exception? innerException = null)
    : Exception(message, innerException)
{
    public Guid? OrphanedDocumentId { get; } = orphanedDocumentId;
}
