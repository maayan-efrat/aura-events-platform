using System.ComponentModel.DataAnnotations;

namespace Events.Api.Dtos;

public record CreateCategoryRequest(
    [Required] string Name,
    Guid? ParentId);

public record CategorySyncRequest(
    [Required] Guid Id,
    [Required] string Name,
    Guid? ParentId);

public record CategoryResponse(Guid CategoryId, string Name, Guid? ParentId);

public record CategoryRef(Guid CategoryId, string Name);
