using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AuraEvents.Shared.Jwt;
using Identity.Api.Entities;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Identity.Api.Services;

public class TokenService : ITokenService
{
    private readonly JwtOptions _options;
    private readonly RSA _privateKey;

    public TokenService(JwtOptions options)
    {
        _options = options;
        if (string.IsNullOrWhiteSpace(options.PrivateKeyPath))
        {
            throw new InvalidOperationException("Identity.Api requires Jwt:PrivateKeyPath to sign access tokens.");
        }

        _privateKey = RsaKeyLoader.LoadPrivateKey(options.PrivateKeyPath);
    }

    public string GenerateAccessToken(User user, IEnumerable<string> roles)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        claims.AddRange(roles.Select(role => new Claim("role", role)));

        var signingCredentials = new SigningCredentials(new RsaSecurityKey(_privateKey), SecurityAlgorithms.RsaSha256);

        var handler = new JsonWebTokenHandler();
        var token = handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenLifetimeMinutes),
            SigningCredentials = signingCredentials,
        });

        return token;
    }

    public (string RawToken, RefreshToken Entity) GenerateRefreshToken(Guid userId, string createdByIp)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var entity = new RefreshToken
        {
            TokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = HashToken(rawToken),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            ExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(_options.RefreshTokenLifetimeDays),
            CreatedByIp = createdByIp,
        };

        return (rawToken, entity);
    }

    public string HashToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToBase64String(bytes);
    }
}
