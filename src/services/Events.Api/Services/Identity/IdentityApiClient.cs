using System.Net.Http.Json;

namespace Events.Api.Services.Identity;

public sealed class IdentityApiClient(HttpClient httpClient, IdentityApiOptions options, ILogger<IdentityApiClient> logger) : IIdentityApiClient
{
    private const string SyncKeyHeader = "X-Users-Sync-Key";

    public async Task<IReadOnlyList<UserSummaryLite>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0)
        {
            return [];
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/internal/users/bulk")
        {
            Content = JsonContent.Create(new { userIds }),
        };
        request.Headers.Add(SyncKeyHeader, options.SyncKey);

        using var response = await httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Identity.Api bulk user lookup failed with {StatusCode}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Identity.Api bulk user lookup failed with status {response.StatusCode}.");
        }

        return await response.Content.ReadFromJsonAsync<List<UserSummaryLite>>(cancellationToken: ct) ?? [];
    }
}
