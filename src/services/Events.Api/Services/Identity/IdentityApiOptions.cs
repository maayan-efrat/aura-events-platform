namespace Events.Api.Services.Identity;

/// <summary>Where/how to reach Identity.Api's internal bulk-user-lookup endpoint (shared secret, not a user JWT).</summary>
public sealed class IdentityApiOptions
{
    public const string SectionName = "IdentityApi";

    public required string BaseUrl { get; init; }
    public required string SyncKey { get; init; }
}
