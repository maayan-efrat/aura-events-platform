# JWT signing keys (local dev)

This folder holds the RSA keypair Identity.Api uses to sign access tokens (RS256) and that
Identity.Api / Events.Api use to validate them. Both `.pem` files are gitignored — regenerate
them per environment, never commit or share the private key.

Regenerate with:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
openssl rsa -pubout -in jwt-private.pem -out jwt-public.pem
```

In production, replace this file-mount approach with a secrets manager (Azure Key Vault, AWS
Secrets Manager, etc.) and inject the keys at deploy time instead of committing them to the
container image or a shared volume.
