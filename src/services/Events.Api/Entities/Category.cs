namespace Events.Api.Entities;

/// <summary>
/// Mirrors a published "categoryItem" node from Umbraco (CategoryId = the Umbraco content key) —
/// Umbraco is the source of truth for the tree; this table exists so Events.Api can filter/join
/// fast without calling out to Umbraco per request. Kept up to date by
/// CategorySyncNotificationHandler in the CMS project via CategoriesController's internal sync
/// endpoints.
/// </summary>
public class Category
{
    public Guid CategoryId { get; set; }
    public required string Name { get; set; }
    public Guid? ParentId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public List<EventCategory> EventCategories { get; set; } = [];
}
