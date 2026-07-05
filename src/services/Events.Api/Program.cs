using AuraEvents.Shared.Jwt;
using Events.Api.Data;
using Events.Api.Entities;
using Events.Api.Services.AI;
using Events.Api.Services.CategorySync;
using Events.Api.Services.Qr;
using Events.Api.Services.Umbraco;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

const string NextJsCorsPolicy = "NextJsFrontend";

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<EventsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("EventsDb"))
        .UseSnakeCaseNamingConvention());

builder.Services.AddAuraEventsJwtAuthentication(builder.Configuration);

builder.Services.AddSingleton(builder.Configuration.GetSection(OpenAIOptions.SectionName).Get<OpenAIOptions>()
    ?? throw new InvalidOperationException($"Missing '{OpenAIOptions.SectionName}' configuration section."));
builder.Services.AddSingleton<IAuraAIService, AuraAIService>();

builder.Services.AddSingleton(builder.Configuration.GetSection(UmbracoOptions.SectionName).Get<UmbracoOptions>()
    ?? throw new InvalidOperationException($"Missing '{UmbracoOptions.SectionName}' configuration section."));

builder.Services.AddSingleton(builder.Configuration.GetSection(CategorySyncOptions.SectionName).Get<CategorySyncOptions>()
    ?? throw new InvalidOperationException($"Missing '{CategorySyncOptions.SectionName}' configuration section."));
builder.Services.AddSingleton<UmbracoTokenProvider>();
builder.Services.AddSingleton<UmbracoImageMediaTypeResolver>();
builder.Services.AddHttpClient<IUmbracoContentService, UmbracoContentService>((sp, client) =>
{
    var umbracoOptions = sp.GetRequiredService<UmbracoOptions>();
    client.BaseAddress = new Uri(umbracoOptions.BaseUrl);
});
builder.Services.AddHttpClient<IUmbracoMediaService, UmbracoMediaService>((sp, client) =>
{
    var umbracoOptions = sp.GetRequiredService<UmbracoOptions>();
    client.BaseAddress = new Uri(umbracoOptions.BaseUrl);
});

builder.Services.AddSingleton<IQrCodeService, QrCodeService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(NextJsCorsPolicy, policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EventsDbContext>();
    db.Database.Migrate();

    // Matches the "AuraEvents Launch Night" demo content seeded by
    // cms/AuraEvents.Umbraco/Composing/EventContentTypeComposer.cs — that composer creates the
    // Umbraco side (referencing this EventId as its systemEventId) but has no way to create the
    // transactional Postgres side, so we do it here. Without this row, viewing the demo event
    // works (it's served entirely from Umbraco) but registering for it 404s, since Registrations
    // requires a real Events row.
    var demoEventId = Guid.Parse("97cb325e-266f-41a9-9623-83bbecd5c361");
    if (!await db.Events.AnyAsync(e => e.EventId == demoEventId))
    {
        db.Events.Add(new Event
        {
            EventId = demoEventId,
            UmbracoContentKey = Guid.Parse("f57c043d-3b99-4957-9104-e2f5b30b7c35"),
            Slug = "auraevents-launch-night",
            Title = "AuraEvents Launch Night",
            StartAtUtc = DateTimeOffset.Parse("2026-09-01T17:00:00Z"),
            EndAtUtc = DateTimeOffset.Parse("2026-09-01T20:00:00Z"),
            Timezone = "Asia/Jerusalem",
            VenueName = "Tel Aviv, Israel",
            IsVirtual = false,
            Capacity = 200,
            Status = EventStatus.Published,
            CreatedByUserId = Guid.Empty,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(NextJsCorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
