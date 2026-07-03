using AuraEvents.Shared.Jwt;
using Identity.Api.Data;
using Identity.Api.Dtos;
using Identity.Api.Entities;
using Identity.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Identity.Api.Controllers;

[ApiController]
[Route("api/identity/auth")]
public class AuthController(
    IdentityDbContext db,
    ITokenService tokenService,
    JwtOptions jwtOptions,
    ILogger<AuthController> logger) : ControllerBase
{
    private static readonly PasswordHasher<User> PasswordHasher = new();
    private const string RefreshCookieName = "refreshToken";

    [HttpPost("register")]
    [EnableRateLimiting("AuthEndpoints")]
    public async Task<ActionResult<RegisterResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();

        var alreadyExists = await db.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail, ct);
        if (alreadyExists)
        {
            return Conflict(new ErrorResponse(new ErrorBody("EMAIL_ALREADY_EXISTS", "An account with this email already exists.")));
        }

        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            PasswordHash = string.Empty,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
        user.PasswordHash = PasswordHasher.HashPassword(user, request.Password);

        var attendeeRole = await db.Roles.SingleAsync(r => r.Name == RoleNames.Attendee, ct);
        user.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = attendeeRole.RoleId });

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("User {UserId} registered", user.UserId);

        return CreatedAtAction(nameof(Register), new RegisterResponse(user.UserId, user.Email, user.FirstName, user.LastName));
    }

    [HttpPost("login")]
    [EnableRateLimiting("AuthEndpoints")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);

        if (user is null || !user.IsActive)
        {
            return Unauthorized(new ErrorResponse(new ErrorBody("INVALID_CREDENTIALS", "Invalid email or password.")));
        }

        if (user.LockoutEndUtc is not null && user.LockoutEndUtc > DateTimeOffset.UtcNow)
        {
            return StatusCode(StatusCodes.Status423Locked,
                new ErrorResponse(new ErrorBody("ACCOUNT_LOCKED", "This account is temporarily locked.")));
        }

        var verifyResult = PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verifyResult == PasswordVerificationResult.Failed)
        {
            user.AccessFailedCount++;
            if (user.AccessFailedCount >= 5)
            {
                user.LockoutEndUtc = DateTimeOffset.UtcNow.AddMinutes(15);
            }
            await db.SaveChangesAsync(ct);
            return Unauthorized(new ErrorResponse(new ErrorBody("INVALID_CREDENTIALS", "Invalid email or password.")));
        }

        user.AccessFailedCount = 0;
        user.LockoutEndUtc = null;

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToArray();
        var accessToken = tokenService.GenerateAccessToken(user, roles);
        var (rawRefreshToken, refreshTokenEntity) = tokenService.GenerateRefreshToken(user.UserId, GetClientIp());

        db.RefreshTokens.Add(refreshTokenEntity);
        await db.SaveChangesAsync(ct);

        SetRefreshTokenCookie(rawRefreshToken, refreshTokenEntity.ExpiresAtUtc);

        return Ok(new LoginResponse(
            accessToken,
            jwtOptions.AccessTokenLifetimeMinutes * 60,
            new UserSummary(user.UserId, user.Email, user.FirstName, user.LastName, roles)));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshResponse>> Refresh(CancellationToken ct)
    {
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) || string.IsNullOrEmpty(rawToken))
        {
            return Unauthorized(new ErrorResponse(new ErrorBody("INVALID_OR_EXPIRED_REFRESH_TOKEN", "No refresh token provided.")));
        }

        var tokenHash = tokenService.HashToken(rawToken);
        var existingToken = await db.RefreshTokens
            .Include(t => t.User).ThenInclude(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

        if (existingToken is null)
        {
            return Unauthorized(new ErrorResponse(new ErrorBody("INVALID_OR_EXPIRED_REFRESH_TOKEN", "Refresh token not recognized.")));
        }

        if (existingToken.RevokedAtUtc is not null)
        {
            // Reuse of an already-rotated token indicates possible theft — revoke the whole active family for this user.
            logger.LogWarning("Refresh token reuse detected for user {UserId}", existingToken.UserId);
            var activeTokens = await db.RefreshTokens
                .Where(t => t.UserId == existingToken.UserId && t.RevokedAtUtc == null)
                .ToListAsync(ct);
            foreach (var token in activeTokens)
            {
                token.RevokedAtUtc = DateTimeOffset.UtcNow;
            }
            await db.SaveChangesAsync(ct);
            Response.Cookies.Delete(RefreshCookieName);
            return Unauthorized(new ErrorResponse(new ErrorBody("INVALID_OR_EXPIRED_REFRESH_TOKEN", "Refresh token has already been used.")));
        }

        if (!existingToken.IsActive)
        {
            return Unauthorized(new ErrorResponse(new ErrorBody("INVALID_OR_EXPIRED_REFRESH_TOKEN", "Refresh token has expired.")));
        }

        var (newRawToken, newTokenEntity) = tokenService.GenerateRefreshToken(existingToken.UserId, GetClientIp());
        existingToken.RevokedAtUtc = DateTimeOffset.UtcNow;
        existingToken.ReplacedByTokenHash = newTokenEntity.TokenHash;
        db.RefreshTokens.Add(newTokenEntity);
        await db.SaveChangesAsync(ct);

        SetRefreshTokenCookie(newRawToken, newTokenEntity.ExpiresAtUtc);

        var roles = existingToken.User.UserRoles.Select(ur => ur.Role.Name);
        var accessToken = tokenService.GenerateAccessToken(existingToken.User, roles);

        return Ok(new RefreshResponse(accessToken, jwtOptions.AccessTokenLifetimeMinutes * 60));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) && !string.IsNullOrEmpty(rawToken))
        {
            var tokenHash = tokenService.HashToken(rawToken);
            var existingToken = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == tokenHash, ct);
            if (existingToken is not null && existingToken.RevokedAtUtc is null)
            {
                existingToken.RevokedAtUtc = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
            }
        }

        Response.Cookies.Delete(RefreshCookieName);
        return NoContent();
    }

    private void SetRefreshTokenCookie(string rawToken, DateTimeOffset expiresAtUtc)
    {
        Response.Cookies.Append(RefreshCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = expiresAtUtc,
            Path = "/api/identity/auth",
        });
    }

    private string GetClientIp() => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
