namespace Events.Api.Services.Identity;

public sealed record UserSummaryLite(Guid UserId, string Email, string FirstName, string LastName);

public interface IIdentityApiClient
{
    /// <summary>Resolves a batch of UserIds into display names/emails. Unknown ids are simply absent from the result.</summary>
    Task<IReadOnlyList<UserSummaryLite>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct);
}
