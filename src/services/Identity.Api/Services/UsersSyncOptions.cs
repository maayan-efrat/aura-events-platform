namespace Identity.Api.Services;

/// <summary>
/// Shared secret Events.Api presents on its internal bulk-user-lookup calls — same
/// shape/purpose as Events.Api's own CategorySyncOptions (a raw shared-secret header, since the
/// caller is a service, not a user with a JWT).
/// </summary>
public sealed class UsersSyncOptions
{
    public const string SectionName = "UsersSync";

    public required string SyncKey { get; init; }
}
