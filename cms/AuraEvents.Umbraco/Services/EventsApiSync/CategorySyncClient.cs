using System.Net.Http.Json;

namespace AuraEvents.Umbraco.Services.EventsApiSync;

/// <summary>
/// Pushes categoryItem publish/delete events to Events.Api, which mirrors them into its Postgres
/// "categories" table for fast filtering — see CategorySyncNotificationHandler for when these are
/// called. Auth is a shared-secret header, not OAuth: this is an internal, low-stakes MVP call in
/// the opposite direction of UmbracoContentService (Events.Api -> Umbraco), so it gets the
/// simplest mechanism that works rather than a second token-exchange flow.
/// </summary>
public sealed class CategorySyncClient(HttpClient httpClient, EventsApiSyncOptions options, ILogger<CategorySyncClient> logger)
{
    private const string SyncEndpoint = "/api/internal/categories/sync";
    private const string SyncKeyHeader = "X-Category-Sync-Key";

    public async Task SyncPublishedAsync(Guid id, string name, Guid? parentId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, SyncEndpoint)
        {
            Content = JsonContent.Create(new { id, name, parentId }),
        };
        request.Headers.Add(SyncKeyHeader, options.SyncKey);

        using var response = await httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Category sync (publish) for {CategoryId} failed with {StatusCode}: {Body}", id, response.StatusCode, body);
        }
    }

    public async Task SyncDeletedAsync(Guid id, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{SyncEndpoint}/{id}");
        request.Headers.Add(SyncKeyHeader, options.SyncKey);

        using var response = await httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Category sync (delete) for {CategoryId} failed with {StatusCode}: {Body}", id, response.StatusCode, body);
        }
    }
}
