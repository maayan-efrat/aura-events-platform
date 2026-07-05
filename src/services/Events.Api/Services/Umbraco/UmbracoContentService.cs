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
            parent = (object?)null,
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
