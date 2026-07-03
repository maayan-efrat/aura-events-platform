# AuraEvents — Step 1: System Architecture & API Design

Status: **FINALIZED**

## 0. High-level topology

```
                         ┌───────────────────────┐
                         │   Next.js Frontend     │
                         │ (SSR/ISR + Route       │
                         │  Handlers acting as    │
                         │  BFF/token proxy —     │
                         │  calls services         │
                         │  directly, no gateway)  │
                         └───────┬───────┬────────┘
                                 │       │
                 public content  │       │ authenticated actions
                 (no JWT)        │       │ (Bearer JWT)
                                 ▼       ▼
                  ┌──────────────────┐ ┌──────────┐ ┌──────────┐
                  │  Umbraco CMS     │ │Identity  │ │ Events   │
                  │  Delivery API    │ │ .Api     │ │ .Api     │
                  │  (self-hosted,   │ │          │ │(+tracking/│
                  │   Docker)        │ │          │ │ analytics)│
                  └──────────────────┘ └────┬─────┘ └────┬─────┘
                                             │            │
                                        ┌────▼────────────▼────┐
                                        │   PostgreSQL           │
                                        │   (one instance,       │
                                        │   per-service database)│
                                        └─────────────────────────┘
```

Two .NET Core microservices, each owning its own database (logical separation, shared PostgreSQL instance for MVP cost/simplicity):

- **Identity.Api** — registration, login, tokens, user profile
- **Events.Api** — event scheduling (system of record for capacity/dates), registrations, check-in, **and tracking/analytics** (merged in for the MVP; can be split into a standalone `Analytics.Api` later if volume justifies it — the `EventTrackingLog` table is already isolated so the split is low-risk)

**Umbraco** owns *marketing/editorial content* for events (hero images, descriptions, speakers, agenda, sponsors), not transactional data. The two are linked by a shared `EventId` (GUID).

**Finalized decisions:**
1. **Database**: PostgreSQL for all services and Umbraco — better free-tier/cloud-hosting economics (Neon, Supabase, Render, Azure Flexible Server all have workable free/cheap tiers) than SQL Server, while fully supported by Umbraco 13+ and .NET via Npgsql/EF Core.
2. **No API Gateway** for MVP — Next.js calls `Identity.Api` and `Events.Api` directly. Revisit YARP if/when cross-cutting concerns (rate limiting, auth-at-the-edge, service discovery) outgrow what each service can handle individually.
3. **Umbraco**: self-hosted via Docker for local dev (and later, any Docker-capable host in production).
4. **Analytics merged into Events.Api** — one fewer moving part for the MVP; the schema below still keeps tracking data in its own table so it can be peeled off later without a redesign.

---

## 1. Data model / PostgreSQL schema

Two separate PostgreSQL databases on one instance: `auraevents_identity` (owned by Identity.Api) and `auraevents_events` (owned by Events.Api, includes tracking). No cross-database foreign keys are possible in Postgres, so cross-service references (e.g. `Events.CreatedByUserId` → `Users.UserId`) are validated at the application layer, not the DB layer — consistent with microservice data ownership.

Column names are `snake_case` (idiomatic Postgres); map them from PascalCase C# entities using the `EFCore.NamingConventions` package in each `DbContext`.

### 1.1 Identity domain — database `auraevents_identity`

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

CREATE TABLE users (
    user_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               varchar(256) NOT NULL,
    normalized_email    varchar(256) NOT NULL,
    password_hash       varchar(512) NOT NULL,       -- ASP.NET Identity PBKDF2 hash
    first_name          varchar(100) NOT NULL,
    last_name           varchar(100) NOT NULL,
    phone_number        varchar(30),
    email_confirmed     boolean NOT NULL DEFAULT false,
    is_active           boolean NOT NULL DEFAULT true,
    lockout_end_utc     timestamptz,
    access_failed_count int NOT NULL DEFAULT 0,
    created_at_utc      timestamptz NOT NULL DEFAULT now(),
    updated_at_utc      timestamptz,
    CONSTRAINT uq_users_normalized_email UNIQUE (normalized_email)
);

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    name    varchar(50) NOT NULL UNIQUE            -- 'Admin', 'Organizer', 'Attendee'
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id int  NOT NULL REFERENCES roles(role_id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
    token_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash              varchar(512) NOT NULL,   -- SHA-256 of the opaque token; raw value never stored
    expires_at_utc          timestamptz NOT NULL,
    created_at_utc          timestamptz NOT NULL DEFAULT now(),
    created_by_ip           varchar(64),
    revoked_at_utc          timestamptz,
    replaced_by_token_hash  varchar(512)             -- rotation chain, for reuse-detection
);
CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX ix_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

> Optimistic concurrency: instead of an explicit row-version column, use Postgres's built-in `xmin` system column via EF Core's `.IsRowVersion()` mapping to `xmin` (Npgsql supports this natively) — no extra column needed.

### 1.2 Event + tracking domain — database `auraevents_events`

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE events (
    event_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    umbraco_content_key uuid UNIQUE,                  -- FK to Umbraco content node (umbracoNode.uniqueId)
    slug                varchar(200) NOT NULL UNIQUE,
    title                varchar(300) NOT NULL,       -- denormalized copy for fast listing/emails; Umbraco is source of truth for display copy
    start_at_utc         timestamptz NOT NULL,
    end_at_utc           timestamptz NOT NULL,
    timezone             varchar(64) NOT NULL,
    venue_name           varchar(200),
    is_virtual           boolean NOT NULL DEFAULT false,
    capacity             int,                          -- NULL = unlimited
    status               varchar(20) NOT NULL DEFAULT 'Draft'
                         CHECK (status IN ('Draft','Published','Cancelled','Completed')),
    created_by_user_id   uuid NOT NULL,                -- references Users.UserId (Identity.Api) — no cross-DB FK, validated at app layer
    created_at_utc       timestamptz NOT NULL DEFAULT now(),
    updated_at_utc       timestamptz
);
CREATE INDEX ix_events_start_at_utc ON events(start_at_utc);

CREATE TABLE event_registrations (
    registration_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          uuid NOT NULL REFERENCES events(event_id),
    user_id           uuid NOT NULL,                  -- references Users.UserId (Identity.Api)
    status            varchar(20) NOT NULL DEFAULT 'Registered'
                       CHECK (status IN ('Registered','Waitlisted','Cancelled','CheckedIn')),
    registered_at_utc timestamptz NOT NULL DEFAULT now(),
    cancelled_at_utc  timestamptz,
    checked_in_at_utc timestamptz,
    CONSTRAINT uq_event_registrations_event_user UNIQUE (event_id, user_id)
);
CREATE INDEX ix_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX ix_event_registrations_event_id_status ON event_registrations(event_id, status);

CREATE TABLE event_tracking_log (
    tracking_id     bigserial PRIMARY KEY,
    event_id        uuid,                             -- nullable: some tracking is site-wide, not event-scoped
    user_id         uuid,                              -- nullable: anonymous visitors
    anonymous_id    uuid,                              -- cookie-based id, set for anonymous visitors
    session_id      varchar(100),
    event_type      varchar(50) NOT NULL,               -- 'PageView','RegisterClick','RegistrationComplete','CheckIn','ShareClick'
    metadata        jsonb,                               -- flexible extra properties; jsonb is indexable/queryable, unlike SQL Server's NVARCHAR(MAX) equivalent
    occurred_at_utc timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tracking_log_event_id_occurred_at_utc ON event_tracking_log(event_id, occurred_at_utc);
CREATE INDEX ix_tracking_log_user_id_occurred_at_utc ON event_tracking_log(user_id, occurred_at_utc);
```

Kept as one `Events.Api`-owned database with three tables — `events`, `event_registrations`, `event_tracking_log` — rather than a separate service, per the finalized MVP decision. The tracking table is still logically isolated (own table, own indexes, no FKs into the transactional tables beyond a nullable `event_id`), so splitting it into a standalone `Analytics.Api` + database later is a data-migration exercise, not a redesign.

> Scaling note (not needed for MVP): `event_tracking_log` is append-only and write-heavy. When volume grows, consider writing to a queue (e.g. a message broker) and batching into a dedicated analytics store instead of the transactional Postgres instance, and/or monthly partitioning (`pg_partman` or native declarative partitioning on `occurred_at_utc`).

---

## 2. API contracts (Next.js ⇄ .NET microservices)

All authenticated endpoints require `Authorization: Bearer <accessToken>`. All responses are `application/json`. Errors follow a consistent envelope:

```json
{ "error": { "code": "EMAIL_ALREADY_EXISTS", "message": "An account with this email already exists." } }
```

### 2.1 Identity.Api

**POST /api/identity/auth/register**
```json
// Request
{ "email": "jane@example.com", "password": "P@ssw0rd!", "firstName": "Jane", "lastName": "Doe" }
// 201 Response
{ "userId": "b3f1...", "email": "jane@example.com", "firstName": "Jane", "lastName": "Doe" }
```
Errors: `409 EMAIL_ALREADY_EXISTS`, `400 VALIDATION_ERROR`

**POST /api/identity/auth/login**
```json
// Request
{ "email": "jane@example.com", "password": "P@ssw0rd!" }
// 200 Response
{
  "accessToken": "eyJhbGciOi...",
  "expiresInSeconds": 900,
  "user": { "userId": "b3f1...", "email": "jane@example.com", "firstName": "Jane", "lastName": "Doe", "roles": ["Attendee"] }
}
```
Also sets `refreshToken` as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Errors: `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`

**POST /api/identity/auth/refresh** — reads `refreshToken` cookie, rotates it, returns new access token.
```json
// 200 Response
{ "accessToken": "eyJhbGciOi...", "expiresInSeconds": 900 }
```
Errors: `401 INVALID_OR_EXPIRED_REFRESH_TOKEN` (if a revoked/reused token is presented, the whole token family is revoked — reuse-detection)

**POST /api/identity/auth/logout** — revokes the refresh token, clears cookie. `204 No Content`

**GET /api/identity/users/me** (auth required)
```json
{ "userId": "b3f1...", "email": "jane@example.com", "firstName": "Jane", "lastName": "Doe", "phoneNumber": null, "roles": ["Attendee"] }
```

**PUT /api/identity/users/me** (auth required)
```json
// Request
{ "firstName": "Jane", "lastName": "Doe", "phoneNumber": "+1-555-0100" }
// 200 Response — updated user object
```

### 2.2 Events.Api

**GET /api/events/{eventId}/availability** (public)
```json
{ "eventId": "a91c...", "capacity": 200, "registeredCount": 187, "waitlistCount": 4, "status": "Open" }
```

**POST /api/events/{eventId}/registrations** (auth required; userId taken from JWT `sub` claim, not request body)
```json
// 201 Response
{ "registrationId": "e77d...", "eventId": "a91c...", "status": "Registered" }
```
Errors: `409 ALREADY_REGISTERED`, `410 EVENT_CLOSED`; capacity-full returns `201` with `"status": "Waitlisted"` rather than an error.

**DELETE /api/events/{eventId}/registrations/me** (auth required) — `204 No Content`

**GET /api/users/me/registrations** (auth required)
```json
[ { "registrationId": "e77d...", "eventId": "a91c...", "status": "Registered", "registeredAtUtc": "2026-07-02T10:00:00Z" } ]
```

**POST /api/events/{eventId}/checkin** (auth required, role `Organizer` or `Admin`)
```json
// Request
{ "userId": "b3f1..." }
// 200 Response
{ "registrationId": "e77d...", "status": "CheckedIn", "checkedInAtUtc": "2026-07-02T18:03:00Z" }
```

### 2.3 Events.Api — tracking/analytics (merged in for MVP)

**POST /api/events/analytics/track** (auth optional — fire-and-forget from the frontend)
```json
// Request
{ "eventId": "a91c...", "anonymousId": "3fae...", "eventType": "RegisterClick", "sessionId": "sess_123", "metadata": { "source": "homepage-banner" } }
// 202 Accepted
```

**GET /api/events/{eventId}/analytics/summary** (auth required, role `Organizer` or `Admin`)
```json
{ "eventId": "a91c...", "pageViews": 5210, "registerClicks": 640, "registrationsCompleted": 187, "checkIns": 150, "conversionRate": 0.29 }
```

---

## 3. Umbraco headless CMS structure

Umbraco holds **editorial/marketing content only** — never capacity, registration state, or PII. Linked to the transactional record via `systemEventId` (GUID matching `Events.EventId`).

### 3.1 Content types

- **`eventPage`** (Document Type, top-level list under `Events` root)
  - `systemEventId` (Textstring, GUID) — link to `Events.EventId`
  - `summary` (Textstring)
  - `heroImage` (Media Picker)
  - `description` (Rich Text / Block List)
  - `venueDetails` (Rich Text)
  - `speakers` (Block List of `speaker` element type)
  - `agenda` (Block List of `agendaItem` element type)
  - `sponsors` (Multi-Media Picker or Block List of `sponsor`)
  - `seoTitle`, `seoDescription`, `ogImage` (SEO fields)

  Note: **start/end date and venue name live in SQL (`Events` table), not Umbraco** — avoids two sources of truth for the data that drives capacity/business logic. Umbraco can optionally cache a display copy for editorial convenience, but Events.Api is authoritative.

- **`speaker`** (Element Type): `name`, `jobTitle`, `bio`, `photo`, `socialLinks` (multi-url picker)
- **`agendaItem`** (Element Type): `time`, `title`, `description`, `speakerRef` (Content Picker → `speaker`)
- **`sponsor`** (Element Type): `name`, `logo`, `websiteUrl`, `tier`

### 3.2 Delivery mechanism

Use Umbraco's built-in **Content Delivery API** (`/umbraco/delivery/api/v2/content`) as the primary read path:

```
GET /umbraco/delivery/api/v2/content?filter=contentType:eventPage&fields=properties[summary,heroImage,startDate]
GET /umbraco/delivery/api/v2/content/item/{slug}
```

- Published content is public and cacheable (CDN-friendly, no auth needed).
- Draft/preview content requires an `Api-Key` header — used only from the Next.js server for preview mode, never exposed to the browser.
- CORS restricted to the Next.js origin(s).

### 3.3 Frontend composition pattern

For an event detail page, Next.js does **two parallel server-side calls** and merges the results at render time — keeping Umbraco and Events.Api decoupled rather than having one call the other:

```
GET {umbraco}/umbraco/delivery/api/v2/content/item/{slug}   → editorial content (title, images, speakers, agenda)
GET {gateway}/api/events/{eventId}/availability              → live capacity/status
```

This keeps content authoring (marketing team, via Umbraco) fully decoupled from transactional state (registration engine), while the frontend presents them as one page.

---

## 4. Security architecture (JWT)

- **Access token**: JWT, signed **RS256** (asymmetric) — Identity.Api holds the private key; other services validate using the public key via a JWKS endpoint (`GET /api/identity/.well-known/jwks.json`). This means Events.Api and Analytics.Api can validate tokens independently without sharing a secret.
  - Claims: `sub` (userId), `email`, `role` (array), `jti`, `iat`, `exp`.
  - Lifetime: 15 minutes.
- **Refresh token**: opaque random 256-bit value, stored **hashed** (SHA-256) in `RefreshTokens`, delivered only via `HttpOnly` + `Secure` + `SameSite=Strict` cookie — never accessible to frontend JS. Rotated on every use; reuse of a revoked token revokes the entire token family (breach detection).
- **Token handling in Next.js**: use Next.js Route Handlers as a thin BFF — the browser never stores the access token in `localStorage`. The route handler holds the refresh cookie, exchanges it for access tokens server-side, and forwards `Authorization: Bearer` headers to the API Gateway on behalf of the client. This avoids XSS-based token theft.
- **Password storage**: ASP.NET Core Identity's default hasher (PBKDF2-HMAC-SHA256, 100k+ iterations) — never custom crypto.
- **Transport**: HTTPS everywhere, HSTS enabled.
- **CORS**: each service allows only the known Next.js origin(s).
- **Rate limiting**: `/auth/login` and `/auth/register` are rate-limited per-IP at the gateway (e.g. ASP.NET Core `Microsoft.AspNetCore.RateLimiting`) to blunt credential-stuffing/brute force.
- **Authorization**: role claims (`Admin`, `Organizer`, `Attendee`) checked per-endpoint via `[Authorize(Roles = "...")]`; every write endpoint in Events.Api/Analytics.Api derives `userId` from the validated JWT, never trusts a client-supplied `userId` (except the organizer-only check-in endpoint, which explicitly requires the `Organizer`/`Admin` role).
- **Umbraco**: backoffice (editor login) is entirely separate from the public Identity.Api — CMS editors are not platform end-users. Delivery API is read-only and public for published content.
- Without a gateway, each service (`Identity.Api`, `Events.Api`) independently configures its own CORS policy, JWT validation (via the shared JWKS endpoint), and rate limiting — there is no shared edge to enforce these centrally for the MVP. Revisit if this duplication becomes painful.

---

## 5. Step 2 scope

Solution layout, Docker Compose for PostgreSQL, and initial scaffolding for `Identity.Api`, `Events.Api`, and the self-hosted Umbraco CMS project.
