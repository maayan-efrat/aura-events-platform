using System.Security.Claims;
using Identity.Api.Data;
using Identity.Api.Dtos;
using Identity.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Identity.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/identity/users")]
public class UsersController(IdentityDbContext db, UsersSyncOptions syncOptions, ILogger<UsersController> logger) : ControllerBase
{
    private const string SyncKeyHeader = "X-Users-Sync-Key";

    [HttpGet("me")]
    public async Task<ActionResult<UserProfileResponse>> GetMe(CancellationToken ct)
    {
        var userId = GetUserId();
        var user = await db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(u => u.UserId == userId, ct);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(new UserProfileResponse(
            user.UserId, user.Email, user.FirstName, user.LastName, user.PhoneNumber,
            user.UserRoles.Select(ur => ur.Role.Name).ToArray()));
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserProfileResponse>> UpdateMe(UpdateProfileRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var user = await db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .SingleOrDefaultAsync(u => u.UserId == userId, ct);

        if (user is null)
        {
            return NotFound();
        }

        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.PhoneNumber = request.PhoneNumber?.Trim();
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new UserProfileResponse(
            user.UserId, user.Email, user.FirstName, user.LastName, user.PhoneNumber,
            user.UserRoles.Select(ur => ur.Role.Name).ToArray()));
    }

    /// <summary>
    /// Resolves attendee UserIds into display names/emails for Events.Api's organizer-facing
    /// attendee list — service-to-service only (shared secret, not a user JWT), same pattern as
    /// Events.Api's own CategoriesController.SyncCategory.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("/api/internal/users/bulk")]
    public async Task<ActionResult<List<UserSummaryLite>>> GetUsersBulk(BulkUsersRequest request, CancellationToken ct)
    {
        if (!Request.Headers.TryGetValue(SyncKeyHeader, out var providedKey) || providedKey != syncOptions.SyncKey)
        {
            logger.LogWarning("Bulk user lookup rejected: missing or invalid {Header}", SyncKeyHeader);
            return Unauthorized();
        }

        var users = await db.Users
            .Where(u => request.UserIds.Contains(u.UserId))
            .Select(u => new UserSummaryLite(u.UserId, u.Email, u.FirstName, u.LastName))
            .ToListAsync(ct);

        return Ok(users);
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue("sub")!);
}
