using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Events.Api.Services.Umbraco;

/// <summary>
/// Resolves and caches the key of Umbraco's built-in "Image" media type, via
/// GET /umbraco/management/api/v1/item/media-type/search. Deliberately avoids hardcoding a key
/// (unlike EventPageDocumentTypeKey) since we're not creating a custom type — the built-in
/// "Image" type's key can still differ per environment, so this discovers it once and caches it,
/// the same cache-with-lock shape as <see cref="UmbracoTokenProvider"/>.
/// </summary>
public sealed class UmbracoImageMediaTypeResolver(
    UmbracoOptions options,
    UmbracoTokenProvider tokenProvider,
    ILogger<UmbracoImageMediaTypeResolver> logger)
{
    private const string SearchEndpoint = "/umbraco/management/api/v1/item/media-type/search?query=Image";

    private readonly HttpClient _httpClient = new() { BaseAddress = new Uri(options.BaseUrl) };
    private readonly SemaphoreSlim _resolveLock = new(1, 1);
    private Guid? _imageMediaTypeId;

    public async Task<Guid> GetImageMediaTypeIdAsync(CancellationToken ct)
    {
        if (_imageMediaTypeId is { } cached)
        {
            return cached;
        }

        await _resolveLock.WaitAsync(ct);
        try
        {
            if (_imageMediaTypeId is { } cachedAfterLock)
            {
                return cachedAfterLock;
            }

            var accessToken = await tokenProvider.GetAccessTokenAsync(ct);
            using var request = new HttpRequestMessage(HttpMethod.Get, SearchEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            using var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                logger.LogError("Umbraco media-type search failed with {StatusCode}: {Body}", response.StatusCode, errorBody);
                throw new InvalidOperationException($"Umbraco media-type search failed with status {response.StatusCode}.");
            }

            var payload = await response.Content.ReadFromJsonAsync<SearchResponse>(cancellationToken: ct)
                ?? throw new InvalidOperationException("Umbraco media-type search response was empty or unparseable.");

            var match = payload.Items.FirstOrDefault(i => string.Equals(i.Name, "Image", StringComparison.OrdinalIgnoreCase))
                ?? throw new InvalidOperationException("Umbraco has no built-in 'Image' media type — cannot archive ticket QR codes.");

            _imageMediaTypeId = match.Id;
            return match.Id;
        }
        finally
        {
            _resolveLock.Release();
        }
    }

    private sealed record SearchResponse(
        [property: JsonPropertyName("items")] IReadOnlyList<SearchResultItem> Items,
        [property: JsonPropertyName("total")] long Total);

    private sealed record SearchResultItem(
        [property: JsonPropertyName("id")] Guid Id,
        [property: JsonPropertyName("name")] string Name);
}
