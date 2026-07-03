using AuraEvents.Shared.Jwt;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace Identity.Api.Controllers;

/// <summary>
/// Exposes the RSA public key as a JWKS document so other services (and, later, a gateway)
/// can validate access tokens without sharing Identity.Api's private key.
/// </summary>
[ApiController]
[Route("api/identity/.well-known")]
public class JwksController(JwtOptions jwtOptions) : ControllerBase
{
    [HttpGet("jwks.json")]
    public IActionResult GetJwks()
    {
        var publicKey = RsaKeyLoader.LoadPublicKey(jwtOptions.PublicKeyPath);
        var securityKey = new RsaSecurityKey(publicKey) { KeyId = "aura-events-jwt-1" };
        var jwk = JsonWebKeyConverter.ConvertFromRSASecurityKey(securityKey);
        jwk.Use = "sig";
        jwk.Alg = SecurityAlgorithms.RsaSha256;

        return Ok(new { keys = new[] { jwk } });
    }
}
