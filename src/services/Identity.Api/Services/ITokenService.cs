using Identity.Api.Entities;

namespace Identity.Api.Services;

public interface ITokenService
{
    string GenerateAccessToken(User user, IEnumerable<string> roles);
    (string RawToken, RefreshToken Entity) GenerateRefreshToken(Guid userId, string createdByIp);
    string HashToken(string rawToken);
}
