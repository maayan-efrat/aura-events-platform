using Events.Api.Data;
using Events.Api.Dtos;
using Events.Api.Entities;
using Events.Api.Services.CategorySync;
using Events.Api.Services.Umbraco;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Controllers;

[ApiController]
public class CategoriesController(
    EventsDbContext db,
    IUmbracoContentService umbracoContent,
    CategorySyncOptions syncOptions,
    ILogger<CategoriesController> logger) : ControllerBase
{
    private const string SyncKeyHeader = "X-Category-Sync-Key";

    [HttpGet("api/categories")]
    public async Task<ActionResult<List<CategoryResponse>>> GetCategories(CancellationToken ct)
    {
        var categories = await db.Categories
            .Where(c => c.IsActive)
            .Select(c => new CategoryResponse(c.CategoryId, c.Name, c.ParentId))
            .ToListAsync(ct);

        return Ok(categories);
    }

    /// <summary>
    /// Lets an organizer/admin add a category from the event-creation form. Umbraco still ends up
    /// the source of truth (this creates+publishes a real categoryItem node there, same as the
    /// backoffice would), but this also upserts Postgres synchronously in the same request —
    /// CategorySyncNotificationHandler will upsert the identical row again a moment later when its
    /// publish notification fires, which is harmless, but without this the category wouldn't be
    /// usable as a categoryId on this same event-creation request (Postgres sync is otherwise
    /// eventually-consistent, on the order of the CMS process's own notification dispatch).
    /// </summary>
    [HttpPost("api/categories")]
    [Authorize(Policy = "OrganizerOrAdmin")]
    public async Task<ActionResult<CategoryResponse>> CreateCategory(CreateCategoryRequest request, CancellationToken ct)
    {
        if (request.ParentId is not null)
        {
            var parentIsValid = await db.Categories.AnyAsync(c => c.CategoryId == request.ParentId && c.IsActive, ct);
            if (!parentIsValid)
            {
                return BadRequest(new ErrorResponse(new ErrorBody("VALIDATION_ERROR", "parentId is unknown or inactive.")));
            }
        }

        Guid categoryId;
        try
        {
            categoryId = await umbracoContent.CreateAndPublishCategoryAsync(request.Name, request.ParentId, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create/publish category '{Name}' in Umbraco", request.Name);
            return StatusCode(StatusCodes.Status502BadGateway,
                new ErrorResponse(new ErrorBody("UMBRACO_PUBLISH_FAILED", "יצירת הקטגוריה ב-CMS נכשלה. נסו שוב.")));
        }

        // Upsert, not a blind Add: CategorySyncNotificationHandler reacts to the same publish call
        // just made above and could race this request to insert the row first.
        var existingRow = await db.Categories.SingleOrDefaultAsync(c => c.CategoryId == categoryId, ct);
        if (existingRow is null)
        {
            db.Categories.Add(new Category
            {
                CategoryId = categoryId,
                Name = request.Name,
                ParentId = request.ParentId,
                IsActive = true,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            existingRow.Name = request.Name;
            existingRow.ParentId = request.ParentId;
            existingRow.IsActive = true;
            existingRow.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        return Ok(new CategoryResponse(categoryId, request.Name, request.ParentId));
    }

    [HttpPut("api/internal/categories/sync")]
    public async Task<IActionResult> SyncCategory(CategorySyncRequest request, CancellationToken ct)
    {
        if (!HasValidSyncKey())
        {
            return Unauthorized();
        }

        var category = await db.Categories.SingleOrDefaultAsync(c => c.CategoryId == request.Id, ct);
        if (category is null)
        {
            db.Categories.Add(new Category
            {
                CategoryId = request.Id,
                Name = request.Name,
                ParentId = request.ParentId,
                IsActive = true,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            category.Name = request.Name;
            category.ParentId = request.ParentId;
            category.IsActive = true;
            category.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Soft-deletes <paramref name="id"/> and every descendant in one statement — a branch
    /// delete/unpublish in Umbraco isn't guaranteed to notify for each descendant individually, but
    /// Postgres already has the full parent_id chain, so the cascade is computed here rather than
    /// requiring the Umbraco-side handler to enumerate descendants itself.
    /// </summary>
    [HttpDelete("api/internal/categories/sync/{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken ct)
    {
        if (!HasValidSyncKey())
        {
            return Unauthorized();
        }

        await db.Database.ExecuteSqlInterpolatedAsync($"""
            WITH RECURSIVE category_tree AS (
                SELECT category_id FROM categories WHERE category_id = {id}
                UNION ALL
                SELECT c.category_id FROM categories c
                JOIN category_tree ct ON c.parent_id = ct.category_id
            )
            UPDATE categories SET is_active = false, updated_at_utc = now()
            WHERE category_id IN (SELECT category_id FROM category_tree)
            """, ct);

        return NoContent();
    }

    private bool HasValidSyncKey()
    {
        if (!Request.Headers.TryGetValue(SyncKeyHeader, out var providedKey) || providedKey != syncOptions.SyncKey)
        {
            logger.LogWarning("Category sync request rejected: missing or invalid {Header}", SyncKeyHeader);
            return false;
        }

        return true;
    }
}
