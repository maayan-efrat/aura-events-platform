using Events.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Events.Api.Data;

public class EventsDbContext(DbContextOptions<EventsDbContext> options) : DbContext(options)
{
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();
    public DbSet<EventTrackingLog> EventTrackingLog => Set<EventTrackingLog>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<EventCategory> EventCategories => Set<EventCategory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Event>(entity =>
        {
            entity.HasKey(e => e.EventId);
            entity.Property(e => e.EventId).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Slug).HasMaxLength(200).IsRequired();
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.UmbracoContentKey).IsUnique();
            entity.Property(e => e.Title).HasMaxLength(300).IsRequired();
            entity.Property(e => e.Timezone).HasMaxLength(64).IsRequired();
            entity.Property(e => e.VenueName).HasMaxLength(200);
            entity.Property(e => e.Status).HasMaxLength(20).IsRequired();
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.StartAtUtc);
            entity.ToTable(t => t.HasCheckConstraint(
                "ck_events_status",
                "status IN ('Draft','Published','Cancelled','Completed')"));
        });

        modelBuilder.Entity<EventRegistration>(entity =>
        {
            entity.HasKey(r => r.RegistrationId);
            entity.Property(r => r.RegistrationId).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(r => r.Status).HasMaxLength(20).IsRequired();
            entity.Property(r => r.RegisteredAtUtc).HasDefaultValueSql("now()");
            entity.HasIndex(r => new { r.EventId, r.UserId }).IsUnique();
            entity.HasIndex(r => r.UserId);
            entity.HasIndex(r => new { r.EventId, r.Status });
            entity.Property(r => r.TicketCode).HasMaxLength(64).IsRequired();
            entity.HasIndex(r => r.TicketCode).IsUnique();
            entity.HasOne(r => r.Event).WithMany(e => e.Registrations).HasForeignKey(r => r.EventId);
            entity.ToTable(t => t.HasCheckConstraint(
                "ck_event_registrations_status",
                "status IN ('Registered','Waitlisted','Cancelled','CheckedIn')"));
        });

        modelBuilder.Entity<EventTrackingLog>(entity =>
        {
            entity.HasKey(t => t.TrackingId);
            entity.Property(t => t.SessionId).HasMaxLength(100);
            entity.Property(t => t.EventType).HasMaxLength(50).IsRequired();
            entity.Property(t => t.MetadataJson).HasColumnName("metadata").HasColumnType("jsonb");
            entity.Property(t => t.OccurredAtUtc).HasDefaultValueSql("now()");
            entity.HasIndex(t => new { t.EventId, t.OccurredAtUtc });
            entity.HasIndex(t => new { t.UserId, t.OccurredAtUtc });
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(c => c.CategoryId);
            entity.Property(c => c.Name).HasMaxLength(200).IsRequired();
            entity.Property(c => c.UpdatedAtUtc).HasDefaultValueSql("now()");
            entity.HasOne<Category>().WithMany().HasForeignKey(c => c.ParentId);
            entity.HasIndex(c => c.ParentId);
        });

        modelBuilder.Entity<EventCategory>(entity =>
        {
            entity.HasKey(ec => new { ec.EventId, ec.CategoryId });
            entity.HasOne(ec => ec.Event).WithMany(e => e.EventCategories).HasForeignKey(ec => ec.EventId);
            entity.HasOne(ec => ec.Category).WithMany(c => c.EventCategories).HasForeignKey(ec => ec.CategoryId);
        });
    }
}
