using AuraEvents.Shared.Jwt;
using Events.Api.Data;
using Events.Api.Services.AI;
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
