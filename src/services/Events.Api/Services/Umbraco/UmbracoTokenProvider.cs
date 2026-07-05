using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Events.Api.Services.Umbraco;

/// <summary>
/// Caches the Umbraco Management API client-credentials bearer token, refreshing it shortly
/// before expiry. Umbraco 14+'s backoffice auth (OpenIddict) only exposes authorization_code
/// (interactive login) and client_credentials (this) grants — there is no password/ROPC grant.
/// </summary>
public sealed class UmbracoTokenProvider(UmbracoOptions options, ILogger<UmbracoTokenProvider> logger)
{
    private readonly HttpClient _httpClient = new() { BaseAddress = new Uri(options.BaseUrl) };
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private string? _accessToken;
    private DateTimeOffset _expiresAtUtc = DateTimeOffset.MinValue;

    public async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        if (_accessToken is not null && DateTimeOffset.UtcNow < _expiresAtUtc)
        {
            return _accessToken;
        }

        await _refreshLock.WaitAsync(ct);
        try
        {
            if (_accessToken is not null && DateTimeOffset.UtcNow < _expiresAtUtc)
            {
                return _accessToken;
            }

            using var requestBody = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = options.ClientId,
                ["client_secret"] = options.ClientSecret,
            });

            using var response = await _httpClient.PostAsync("/umbraco/management/api/v1/security/back-office/token", requestBody, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                logger.LogError("Umbraco token request failed with {StatusCode}: {Body}", response.StatusCode, errorBody);
                throw new InvalidOperationException($"Umbraco token request failed with status {response.StatusCode}.");
            }

            var payload = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct)
                ?? throw new InvalidOperationException("Umbraco token response was empty or unparseable.");

            _accessToken = payload.AccessToken;
            _expiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(payload.ExpiresIn - 30);
            return _accessToken;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("token_type")] string TokenType,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
