namespace AuraEvents.Shared.Jwt;

/// <summary>
/// Bound from the "Jwt" configuration section in every service's appsettings.
/// Identity.Api is the only service configured with a PrivateKeyPath (it issues tokens);
/// all services are configured with PublicKeyPath (they validate tokens).
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required string PublicKeyPath { get; init; }
    public string? PrivateKeyPath { get; init; }
    public int AccessTokenLifetimeMinutes { get; init; } = 15;
    public int RefreshTokenLifetimeDays { get; init; } = 14;
}
