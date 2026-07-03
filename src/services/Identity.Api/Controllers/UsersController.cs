using System.Security.Claims;
using Identity.Api.Data;
using Identity.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Identity.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/identity/users")]
public class UsersController(IdentityDbContext db) : ControllerBase
{
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

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue("sub")!);
}
