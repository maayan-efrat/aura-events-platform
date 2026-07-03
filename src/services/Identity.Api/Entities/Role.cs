namespace Identity.Api.Entities;

public static class RoleNames
{
    public const string Admin = "Admin";
    public const string Organizer = "Organizer";
    public const string Attendee = "Attendee";
}

public class Role
{
    public int RoleId { get; set; }
    public required string Name { get; set; }

    public List<UserRole> UserRoles { get; set; } = [];
}
