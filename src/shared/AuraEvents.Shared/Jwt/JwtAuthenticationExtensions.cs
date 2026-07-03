using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace AuraEvents.Shared.Jwt;

/// <summary>
/// Shared JWT-validation wiring so Identity.Api and Events.Api enforce identical
/// token rules (RS256, issuer/audience/lifetime) without sharing a secret — each
/// service only needs the public key.
/// </summary>
public static class JwtAuthenticationExtensions
{
    public static IServiceCollection AddAuraEventsJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwtOptions = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException($"Missing '{JwtOptions.SectionName}' configuration section.");

        services.AddSingleton(jwtOptions);

        var publicKey = RsaKeyLoader.LoadPublicKey(jwtOptions.PublicKeyPath);

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                // Keep claim types exactly as issued ("sub", "role") instead of ASP.NET's
                // legacy remap to ClaimTypes.NameIdentifier/ClaimTypes.Role.
                options.MapInboundClaims = false;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new RsaSecurityKey(publicKey),
                    RoleClaimType = "role",
                    NameClaimType = "sub",
                };

                options.Events = new JwtBearerEvents
                {
                    OnChallenge = context =>
                    {
                        context.HandleResponse();
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        context.Response.ContentType = "application/json";
                        return context.Response.WriteAsync(JsonSerializer.Serialize(new
                        {
                            error = new { code = "UNAUTHORIZED", message = "A valid access token is required." }
                        }));
                    },
                    OnForbidden = context =>
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        context.Response.ContentType = "application/json";
                        return context.Response.WriteAsync(JsonSerializer.Serialize(new
                        {
                            error = new { code = "FORBIDDEN", message = "You do not have permission to perform this action." }
                        }));
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("OrganizerOrAdmin", policy => policy.RequireRole("Organizer", "Admin"));
            options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
        });

        return services;
    }
}
