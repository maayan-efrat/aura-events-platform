using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Events.Api.Services.Umbraco;

/// <summary>
/// Archives ticket QR PNGs into Umbraco's built-in "Image" media type via the Management API's
/// two-step upload: stage the raw bytes as a temporary file, then create a Media item referencing
/// that temp file. Endpoint shapes (temporary-file multipart contract, CreateMediaRequestModel)
/// verified against this project's live Umbraco 17 swagger spec on 2026-07-05, same method as
/// UmbracoContentService (see docs/testing/umbraco-swagger-verification.md).
///
/// ⚠️ NOT YET EMPIRICALLY VERIFIED: the exact JSON shape of the `umbracoFile` property's value
/// (below, `new { temporaryFileId }`) — MediaValueModel.value is untyped in the OpenAPI spec
/// (property-editor-defined), so this needs one live test run against the dev stack before this
/// is trusted, exactly like the two real bugs the swagger doc caught for document create/publish.
/// </summary>
public sealed class UmbracoMediaService(
    HttpClient httpClient,
    UmbracoTokenProvider tokenProvider,
    UmbracoImageMediaTypeResolver imageMediaTypeResolver,
    ILogger<UmbracoMediaService> logger) : IUmbracoMediaService
{
    private const string TemporaryFileEndpoint = "/umbraco/management/api/v1/temporary-file";
    private const string MediaEndpoint = "/umbraco/management/api/v1/media";

    public async Task<Guid> UploadTicketQrAsync(Guid registrationId, byte[] pngBytes, CancellationToken ct)
    {
        var fileName = $"ticket-{registrationId}.png";

        var temporaryFileId = Guid.NewGuid();
        using (var form = new MultipartFormDataContent())
        {
            form.Add(new StringContent(temporaryFileId.ToString()), "Id");
            var fileContent = new ByteArrayContent(pngBytes);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(fileContent, "File", fileName);

            using var request = new HttpRequestMessage(HttpMethod.Post, TemporaryFileEndpoint) { Content = form };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokenProvider.GetAccessTokenAsync(ct));

            using var response = await httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                logger.LogError("Umbraco temporary-file upload failed with {StatusCode}: {Body}", response.StatusCode, errorBody);
                throw new InvalidOperationException($"Umbraco temporary-file upload failed with status {response.StatusCode}.");
            }
        }

        var imageMediaTypeId = await imageMediaTypeResolver.GetImageMediaTypeIdAsync(ct);
        var mediaId = Guid.NewGuid();
        var createBody = new
        {
            id = mediaId,
            parent = (object?)null,
            mediaType = new { id = imageMediaTypeId },
            values = new object[]
            {
                new { alias = "umbracoFile", value = new { temporaryFileId } },
            },
            variants = new[] { new { culture = (string?)null, segment = (string?)null, name = fileName } },
        };

        using var createRequest = new HttpRequestMessage(HttpMethod.Post, MediaEndpoint) { Content = JsonContent.Create(createBody) };
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokenProvider.GetAccessTokenAsync(ct));

        using var createResponse = await httpClient.SendAsync(createRequest, ct);
        if (!createResponse.IsSuccessStatusCode)
        {
            var errorBody = await createResponse.Content.ReadAsStringAsync(ct);
            logger.LogError("Umbraco media create failed with {StatusCode}: {Body}", createResponse.StatusCode, errorBody);
            throw new InvalidOperationException($"Umbraco media create failed with status {createResponse.StatusCode}.");
        }

        logger.LogInformation("Umbraco media {MediaId} created for registration {RegistrationId}", mediaId, registrationId);
        return mediaId;
    }
}
