using Identity.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Identity.Api.Data;

public class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.UserId);
            entity.Property(u => u.UserId).HasDefaultValueSql("gen_random_uuid()");
            entity.HasIndex(u => u.NormalizedEmail).IsUnique();
            entity.Property(u => u.Email).HasMaxLength(256).IsRequired();
            entity.Property(u => u.NormalizedEmail).HasMaxLength(256).IsRequired();
            entity.Property(u => u.PasswordHash).HasMaxLength(512).IsRequired();
            entity.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(u => u.LastName).HasMaxLength(100).IsRequired();
            entity.Property(u => u.PhoneNumber).HasMaxLength(30);
            entity.Property(u => u.CreatedAtUtc).HasDefaultValueSql("now()");
            // Optimistic concurrency via Postgres's built-in xmin system column — no extra column needed.
            entity.Property<uint>("xmin").IsRowVersion();
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(r => r.RoleId);
            entity.Property(r => r.Name).HasMaxLength(50).IsRequired();
            entity.HasIndex(r => r.Name).IsUnique();

            entity.HasData(
                new Role { RoleId = 1, Name = Entities.RoleNames.Admin },
                new Role { RoleId = 2, Name = Entities.RoleNames.Organizer },
                new Role { RoleId = 3, Name = Entities.RoleNames.Attendee }
            );
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(ur => new { ur.UserId, ur.RoleId });
            entity.HasOne(ur => ur.User).WithMany(u => u.UserRoles).HasForeignKey(ur => ur.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ur => ur.Role).WithMany(r => r.UserRoles).HasForeignKey(ur => ur.RoleId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(t => t.TokenId);
            entity.Property(t => t.TokenId).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(t => t.TokenHash).HasMaxLength(512).IsRequired();
            entity.Property(t => t.CreatedByIp).HasMaxLength(64);
            entity.Property(t => t.ReplacedByTokenHash).HasMaxLength(512);
            entity.Property(t => t.CreatedAtUtc).HasDefaultValueSql("now()");
            entity.HasIndex(t => t.UserId);
            entity.HasIndex(t => t.TokenHash);
            entity.HasOne(t => t.User).WithMany(u => u.RefreshTokens).HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.Ignore(t => t.IsActive);
        });
    }
}
