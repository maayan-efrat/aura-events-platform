using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Events.Api.Data;

/// <summary>
/// Lets `dotnet ef migrations` build the model without booting the full app host
/// (which requires JWT key files to exist on disk) — design-time only.
/// </summary>
public class EventsDbContextFactory : IDesignTimeDbContextFactory<EventsDbContext>
{
    public EventsDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<EventsDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=auraevents_events;Username=auraevents;Password=design-time")
            .UseSnakeCaseNamingConvention();

        return new EventsDbContext(optionsBuilder.Options);
    }
}
