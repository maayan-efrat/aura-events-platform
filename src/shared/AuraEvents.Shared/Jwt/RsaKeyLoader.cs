using System.Security.Cryptography;

namespace AuraEvents.Shared.Jwt;

/// <summary>
/// Loads RSA keys from PEM files on disk. Identity.Api loads both keys (to sign);
/// Events.Api loads only the public key (to validate). Keys live outside source control —
/// see /keys/README.md for local generation and the docker-compose volume mount.
/// </summary>
public static class RsaKeyLoader
{
    public static RSA LoadPublicKey(string publicKeyPath)
    {
        var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(publicKeyPath));
        return rsa;
    }

    public static RSA LoadPrivateKey(string privateKeyPath)
    {
        var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(privateKeyPath));
        return rsa;
    }
}
