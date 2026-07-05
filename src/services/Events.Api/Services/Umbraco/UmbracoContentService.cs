using System.Net.Http.Headers;
using System.Net.Http.Json;
using Events.Api.Dtos;

namespace Events.Api.Services.Umbraco;

/// <summary>
/// Calls Umbraco's Management API to create and publish "eventPage" documents. Endpoints and
/// request/response shapes verified directly against this project's own running Umbraco 17
/// instance (GET /umbraco/swagger/management/swagger.json, schemas CreateDocumentRequestModel /
/// PublishDocumentRequestModel) on 2026-07-05 — see docs/testing/umbraco-swagger-verification.md
/// for the full findings, including two bugs this caught: `template` is a required key on create
/// (nullable value, but must be present) and publish takes `publishSchedules`, not `variants`.
/// DELETE /document/{id} is a genuine hard delete — Umbraco has a separate
/// /document/{id}/move-to-recycle-bin endpoint for the soft-delete case, so no recycle-bin
/// clean-up step is needed here.
/// </summary>
public sealed class UmbracoContentService(
    HttpClient httpClient,
    UmbracoTokenProvider tokenProvider,
    UmbracoOptions options,
    ILogger<UmbracoContentService> logger) : IUmbracoContentService
{
    private const string DocumentEndpoint = "/umbraco/management/api/v1/document";

    // Umbraco's built-in "Image" media type — a well-known system GUID identical across every
    // Umbraco installation (confirmed via GET /media-type/allowed-at-root on this project's own
    // instance), not environment-specific like the content-type keys in UmbracoOptions.
    private static readonly Guid ImageMediaTypeKey = Guid.Parse("cc07b313-0843-4aa8-bbda-871c8da728c8");

    public async Task<Guid> CreateAndPublishEventPageAsync(Guid eventId, string title, EventContentRequest content, CancellationToken ct)
    {
        // Umbraco's 201 response has no JSON body (only Umb-Generated-Resource/Location headers —
        // confirmed against the real spec), so the id must be supplied client-side, not read back.
        var documentId = Guid.NewGuid();
        var createBody = new
        {
            id = documentId,
            documentType = new { id = options.EventPageDocumentTypeKey },
            template = (object?)null, // required key on CreateDocumentRequestModel, but nullable
            parent = new { id = options.EventsRootFolderKey },
            variants = new[] { new { culture = (string?)null, segment = (string?)null, name = title } },
            values = new object[]
            {
                new { alias = "systemEventId", value = eventId.ToString() },
                new { alias = "summary", value = content.Summary },
                new { alias = "description", value = content.Description },
                new { alias = "seoTitle", value = content.SeoTitle },
                new { alias = "seoDescription", value = content.SeoDescription },
            },
        };

        using var createRequest = await BuildRequestAsync(HttpMethod.Post, DocumentEndpoint, createBody, ct);
        using var createResponse = await httpClient.SendAsync(createRequest, ct);
        if (!createResponse.IsSuccessStatusCode)
        {
            var errorBody = await createResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Umbraco document create failed with {StatusCode}: {Body}", createResponse.StatusCode, errorBody);
            throw new UmbracoPublishException($"Umbraco document create failed with status {createResponse.StatusCode}.");
        }

        logger.LogInformation("Umbraco document {DocumentId} created for event {EventId}", documentId, eventId);

        // PublishDocumentRequestModel takes `publishSchedules`, not `variants` — a bare `{ culture: null }`
        // entry means "publish the invariant variant now" (no schedule).
        var publishBody = new { publishSchedules = new[] { new { culture = (string?)null } } };
        using var publishRequest = await BuildRequestAsync(HttpMethod.Put, $"{DocumentEndpoint}/{documentId}/publish", publishBody, ct);
        using var publishResponse = await httpClient.SendAsync(publishRequest, ct);
        if (publishResponse.IsSuccessStatusCode)
        {
            logger.LogInformation("Umbraco document {DocumentId} published for event {EventId}", documentId, eventId);

            // Best-effort: a hero image is a nice-to-have, not required for the event to exist —
            // a failure here is logged but doesn't fail the whole create/publish call.
            if (!string.IsNullOrEmpty(content.HeroImageBase64) && !string.IsNullOrEmpty(content.HeroImageFileName))
            {
                try
                {
                    var imageBytes = Convert.FromBase64String(content.HeroImageBase64);
                    var mediaKey = await UploadHeroImageAsync(imageBytes, content.HeroImageFileName, content.HeroImageContentType ?? "application/octet-stream", ct);
                    await AttachHeroImageAsync(documentId, eventId, title, content, mediaKey, ct);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to attach hero image for event {EventId} — content was created/published without it.", eventId);
                }
            }

            return documentId;
        }

        var publishErrorBody = await publishResponse.Content.ReadAsStringAsync(ct);
        logger.LogError("Umbraco document publish failed with {StatusCode}: {Body}", publishResponse.StatusCode, publishErrorBody);

        // A publish failure after a successful create leaves an unpublished draft behind. Delete
        // it so a failed attempt never leaves a dangling node in Umbraco — the caller's retry
        // endpoint always creates a fresh document rather than trying to "adopt" a leftover draft.
        try
        {
            await DeleteEventPageAsync(documentId, ct);
        }
        catch (Exception cleanupEx)
        {
            logger.LogError(cleanupEx,
                "Failed to clean up orphaned Umbraco draft {DocumentId} after publish failure ({PublishStatusCode}) — manual cleanup required in the backoffice.",
                documentId, publishResponse.StatusCode);
            throw new UmbracoPublishException(
                $"Umbraco document publish failed with status {publishResponse.StatusCode}, and cleanup of the orphaned draft also failed.",
                orphanedDocumentId: documentId,
                innerException: cleanupEx);
        }

        throw new UmbracoPublishException($"Umbraco document publish failed with status {publishResponse.StatusCode}.");
    }

    /// <summary>
    /// Uploads a temporary file then wraps it in a Media item — the two-step dance Umbraco's
    /// Management API requires for any binary upload (confirmed against this project's own
    /// running instance: POST /temporary-file with multipart form data, then POST /media
    /// referencing that temp file's id as the "umbracoFile" property value).
    /// </summary>
    private async Task<Guid> UploadHeroImageAsync(byte[] fileBytes, string fileName, string contentType, CancellationToken ct)
    {
        var accessToken = await tokenProvider.GetAccessTokenAsync(ct);
        var tempFileId = Guid.NewGuid();

        using var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        using var multipart = new MultipartFormDataContent
        {
            { new StringContent(tempFileId.ToString()), "Id" },
            { fileContent, "File", fileName },
        };

        using var uploadRequest = new HttpRequestMessage(HttpMethod.Post, "/umbraco/management/api/v1/temporary-file") { Content = multipart };
        uploadRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var uploadResponse = await httpClient.SendAsync(uploadRequest, ct);
        if (!uploadResponse.IsSuccessStatusCode)
        {
            var body = await uploadResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Temporary file upload failed with {StatusCode}: {Body}", uploadResponse.StatusCode, body);
            throw new UmbracoPublishException($"Temporary file upload failed with status {uploadResponse.StatusCode}.");
        }

        var mediaId = Guid.NewGuid();
        var createMediaBody = new
        {
            id = mediaId,
            mediaType = new { id = ImageMediaTypeKey },
            parent = (object?)null,
            variants = new[] { new { culture = (string?)null, segment = (string?)null, name = fileName } },
            values = new object[] { new { alias = "umbracoFile", value = new { temporaryFileId = tempFileId } } },
        };

        using var createMediaRequest = await BuildRequestAsync(HttpMethod.Post, "/umbraco/management/api/v1/media", createMediaBody, ct);
        using var createMediaResponse = await httpClient.SendAsync(createMediaRequest, ct);
        if (!createMediaResponse.IsSuccessStatusCode)
        {
            var body = await createMediaResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Media create failed with {StatusCode}: {Body}", createMediaResponse.StatusCode, body);
            throw new UmbracoPublishException($"Media create failed with status {createMediaResponse.StatusCode}.");
        }

        return mediaId;
    }

    /// <summary>
    /// Sets the "heroImage" MediaPicker3 value on an already-published eventPage and republishes.
    /// PUT /document/{id} is a full replace of `values` (confirmed empirically: aliases omitted
    /// from the array get wiped, not left alone) — every existing property must be resent here
    /// alongside heroImage, or systemEventId/summary/etc. would be blanked out.
    /// </summary>
    private async Task AttachHeroImageAsync(Guid documentId, Guid eventId, string title, EventContentRequest content, Guid mediaKey, CancellationToken ct)
    {
        var updateBody = new
        {
            values = new object[]
            {
                new { alias = "systemEventId", value = eventId.ToString() },
                new { alias = "summary", value = content.Summary },
                new { alias = "description", value = content.Description },
                new { alias = "seoTitle", value = content.SeoTitle },
                new { alias = "seoDescription", value = content.SeoDescription },
                new
                {
                    alias = "heroImage",
                    value = new[]
                    {
                        new { key = Guid.NewGuid(), mediaKey, mediaTypeAlias = "Image", crops = Array.Empty<object>(), focalPoint = (object?)null },
                    },
                },
            },
            variants = new[] { new { culture = (string?)null, segment = (string?)null, name = title } },
        };

        using var updateRequest = await BuildRequestAsync(HttpMethod.Put, $"{DocumentEndpoint}/{documentId}", updateBody, ct);
        using var updateResponse = await httpClient.SendAsync(updateRequest, ct);
        if (!updateResponse.IsSuccessStatusCode)
        {
            var body = await updateResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Attaching hero image to document {DocumentId} failed with {StatusCode}: {Body}", documentId, updateResponse.StatusCode, body);
            throw new UmbracoPublishException($"Attaching hero image failed with status {updateResponse.StatusCode}.");
        }

        // The update above only touches the draft — republish so the image goes live.
        var publishBody = new { publishSchedules = new[] { new { culture = (string?)null } } };
        using var publishRequest = await BuildRequestAsync(HttpMethod.Put, $"{DocumentEndpoint}/{documentId}/publish", publishBody, ct);
        using var publishResponse = await httpClient.SendAsync(publishRequest, ct);
        if (!publishResponse.IsSuccessStatusCode)
        {
            var body = await publishResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Re-publish after attaching hero image to {DocumentId} failed with {StatusCode}: {Body}", documentId, publishResponse.StatusCode, body);
            throw new UmbracoPublishException($"Re-publish after attaching hero image failed with status {publishResponse.StatusCode}.");
        }
    }

    public async Task<Guid> CreateAndPublishCategoryAsync(string name, Guid? parentId, CancellationToken ct)
    {
        var documentId = Guid.NewGuid();
        var createBody = new
        {
            id = documentId,
            documentType = new { id = options.CategoryItemDocumentTypeKey },
            template = (object?)null,
            parent = new { id = parentId ?? options.CategoriesRootFolderKey },
            variants = new[] { new { culture = (string?)null, segment = (string?)null, name } },
            values = Array.Empty<object>(),
        };

        using var createRequest = await BuildRequestAsync(HttpMethod.Post, DocumentEndpoint, createBody, ct);
        using var createResponse = await httpClient.SendAsync(createRequest, ct);
        if (!createResponse.IsSuccessStatusCode)
        {
            var errorBody = await createResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Umbraco category create failed with {StatusCode}: {Body}", createResponse.StatusCode, errorBody);
            throw new UmbracoPublishException($"Umbraco category create failed with status {createResponse.StatusCode}.");
        }

        var publishBody = new { publishSchedules = new[] { new { culture = (string?)null } } };
        using var publishRequest = await BuildRequestAsync(HttpMethod.Put, $"{DocumentEndpoint}/{documentId}/publish", publishBody, ct);
        using var publishResponse = await httpClient.SendAsync(publishRequest, ct);
        if (publishResponse.IsSuccessStatusCode)
        {
            logger.LogInformation("Umbraco category {DocumentId} created and published", documentId);
            return documentId;
        }

        var publishErrorBody = await publishResponse.Content.ReadAsStringAsync(ct);
        logger.LogError("Umbraco category publish failed with {StatusCode}: {Body}", publishResponse.StatusCode, publishErrorBody);

        try
        {
            await DeleteEventPageAsync(documentId, ct);
        }
        catch (Exception cleanupEx)
        {
            logger.LogError(cleanupEx,
                "Failed to clean up orphaned Umbraco category draft {DocumentId} after publish failure — manual cleanup required in the backoffice.",
                documentId);
            throw new UmbracoPublishException(
                $"Umbraco category publish failed with status {publishResponse.StatusCode}, and cleanup of the orphaned draft also failed.",
                orphanedDocumentId: documentId,
                innerException: cleanupEx);
        }

        throw new UmbracoPublishException($"Umbraco category publish failed with status {publishResponse.StatusCode}.");
    }

    public async Task DeleteEventPageAsync(Guid documentId, CancellationToken ct)
    {
        // Confirmed a genuine hard delete against the real spec (Umbraco has a separate
        // /document/{id}/move-to-recycle-bin endpoint for the soft-delete case) — no body, no
        // recycle-bin follow-up needed here.
        using var deleteRequest = await BuildRequestAsync(HttpMethod.Delete, $"{DocumentEndpoint}/{documentId}", body: null, ct);
        using var deleteResponse = await httpClient.SendAsync(deleteRequest, ct);
        if (!deleteResponse.IsSuccessStatusCode)
        {
            var errorBody = await deleteResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Failed to delete Umbraco document {DocumentId}: {StatusCode} {Body}", documentId, deleteResponse.StatusCode, errorBody);
            throw new UmbracoPublishException($"Failed to delete Umbraco document {documentId}, status {deleteResponse.StatusCode}.", orphanedDocumentId: documentId);
        }

        logger.LogInformation("Umbraco document {DocumentId} deleted", documentId);
    }

    private async Task<HttpRequestMessage> BuildRequestAsync(HttpMethod method, string requestUri, object? body, CancellationToken ct)
    {
        var accessToken = await tokenProvider.GetAccessTokenAsync(ct);
        var request = new HttpRequestMessage(method, requestUri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }
}
