# 🌌 AuraEvents — AI-Powered Smart Event Management Platform

AuraEvents is a high-performance, enterprise-grade event management platform engineered using a cutting-edge **Microservices Architecture** on **.NET 10**, an **Umbraco 17 Headless CMS**, and an animated **Next.js 16 Production Frontend (BFF Pattern)**.

The system leverages **PostgreSQL** as its transactional backbone, features a secure **RS256 JWT Distributed Authentication** model, and seamlessly integrates the **OpenAI SDK** for structured, hallucination-proof AI recommendations and automated content optimization.

---

## 🏗️ System Architecture & Topology

The system is decoupled into specialized services, each independently deployable and independently scalable. There is deliberately **no API gateway yet** (see [Roadmap](#-roadmap--known-limitations)) — the Next.js BFF and mobile client call each backend service directly, and each service enforces its own CORS/JWT/rate-limiting policy.

```
                         ┌────────────────────────┐
                         │   Next.js 16 Frontend   │
                         │  (BFF · RTL Hebrew UI · │
                         │   httpOnly session)     │
                         └───────┬────────┬────────┘
                                 │        │
                 public content  │        │ authenticated actions
                 (SSR, no JWT)   │        │ (Bearer JWT, server-side only)
                                 ▼        ▼
                  ┌──────────────────┐  ┌──────────┐  ┌──────────┐
                  │  Umbraco 17 CMS  │  │Identity  │  │ Events   │
                  │  Delivery API    │  │ .Api     │  │ .Api     │
                  │  (self-hosted,   │  │          │  │ (+ AI,   │
                  │   Docker)        │  │          │  │  tracking)│
                  └──────────────────┘  └────┬─────┘  └────┬─────┘
                                              │             │
                                         ┌────▼─────────────▼────┐
                                         │      PostgreSQL         │
                                         │  (one instance, one     │
                                         │  database per service)  │
                                         └──────────────────────────┘
                                                     ▲
                                                     │ direct Bearer-token calls
                                              ┌──────┴───────┐
                                              │  Expo Mobile  │
                                              │     Client    │
                                              └───────────────┘
```

| Layer | Technology | Responsibility |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), Tailwind v4, Framer Motion | RTL Hebrew UI, BFF session management, SSR event listings |
| **Mobile** | Expo SDK 57, React Native 0.86 | Login, registered-events list, QR check-in mockup |
| **Identity.Api** | ASP.NET Core 10, EF Core, Npgsql | Registration, login, RS256 JWT issuance, refresh-token rotation |
| **Events.Api** | ASP.NET Core 10, EF Core, Npgsql, OpenAI SDK | Events, registrations, check-in, tracking/analytics, AI recommendations & content generation |
| **CMS** | Umbraco 17 (LTS), Delivery API | Editorial event content (headless, decoupled from transactional data) |
| **Database** | PostgreSQL 17 | One shared instance, one database per service (`auraevents_identity`, `auraevents_events`, `auraevents_cms`) |

Full design rationale (schema, API contracts, security model) is in
[docs/architecture/01-system-architecture.md](docs/architecture/01-system-architecture.md).

---

## 🔐 Security Model

- **RS256 JWT, distributed validation**: Identity.Api holds the private signing key; Events.Api validates tokens independently via a shared public key + JWKS endpoint (`/api/identity/.well-known/jwks.json`) — no shared secret between services.
- **Refresh-token rotation with reuse detection**: every refresh issues a new token and revokes the old one; presenting an already-used token revokes the entire session family (breach containment).
- **BFF pattern on the web**: the Next.js frontend never exposes an access or refresh token to browser JavaScript. Both live in `httpOnly` cookies scoped to the Next.js origin; Route Handlers attach the `Authorization: Bearer` header server-side when proxying to the backend.
- **Mobile equivalent**: the Expo app has no DOM/XSS surface, so tokens are stored in `expo-secure-store` (OS-level secure storage) instead of cookies, with the same refresh-and-retry logic as the web BFF.
- **Password hashing**: ASP.NET Core Identity's built-in `PasswordHasher` (PBKDF2-HMAC-SHA256).
- **Rate limiting**: fixed-window limiter on `/auth/login` and `/auth/register` to blunt credential stuffing.

---

## 🤖 AI Integration (Events.Api)

`Events.Api` wraps the official `OpenAI` .NET SDK using **Structured Outputs** (strict JSON-schema mode), so every AI response is schema-conformant JSON — never free text to parse, never a guess.

- **`POST /api/events/ai/recommendations`** — recommends upcoming events based on a user's registration history and stated preferences. The model is constrained to a JSON-schema `enum` of real candidate event IDs pulled from the database, so it is **structurally incapable of recommending an event that doesn't exist**. Titles and dates in the response come from the database, never from the model — the model only supplies the personalized reasoning.
- **`POST /api/events/ai/generate-description`** (Organizer/Admin only) — turns an organizer's raw bullet points into a polished `summary` / `description` / `seoTitle` / `seoDescription`, mapped 1:1 onto the Umbraco `eventPage` content type.

---

## 📁 Project Structure

```
AuraEvents/
├── docs/architecture/           # System design doc (schema, API contracts, security)
├── src/
│   ├── AuraEvents.slnx
│   ├── services/
│   │   ├── Identity.Api/        # registration, login, JWT issuance, user profile
│   │   └── Events.Api/          # events, registrations, check-in, tracking/analytics, AI
│   └── shared/
│       └── AuraEvents.Shared/   # shared JWT validation (RS256) wiring
├── cms/
│   └── AuraEvents.Umbraco/      # headless Umbraco 17 (LTS), Postgres-backed
├── frontend/
│   └── web-app/                 # Next.js 16 — BFF route handlers, RTL Hebrew UI
├── mobile/
│   └── mobile-app/               # Expo — login, registered events, QR mockup
├── deploy/postgres/              # DB init script (creates the 3 per-service databases)
├── keys/                         # local-dev RSA keypair for JWT signing (gitignored)
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Running Locally

### Backend + CMS (Docker)

```bash
cp .env.example .env             # fill in real values
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/jwt-private.pem
openssl rsa -pubout -in keys/jwt-private.pem -out keys/jwt-public.pem

docker compose up --build
```

| Service | URL |
|---|---|
| Identity.Api (Swagger) | http://localhost:5001/swagger |
| Events.Api (Swagger) | http://localhost:5002/swagger |
| Umbraco backoffice | http://localhost:5003/umbraco (`UMBRACO_ADMIN_EMAIL` / `UMBRACO_ADMIN_PASSWORD` from `.env`) |
| Umbraco Delivery API | http://localhost:5003/umbraco/delivery/api/v2/content |

Both `.NET` services run EF Core migrations on startup — the schema is created automatically on
first boot, no manual migration step needed.

### Frontend

```bash
cd frontend/web-app
cp .env.local.example .env.local
npm install
npm run dev   # http://localhost:3000
```

Next.js 16 App Router, RTL Hebrew, Tailwind v4, Framer Motion micro-interactions. Route Handlers
under `src/app/api/` implement the BFF session (`src/lib/session.ts`, `src/lib/backend-fetch.ts`).
The homepage's event listing (`src/components/events/EventListing.tsx`) fetches Umbraco's
Delivery API and Events.Api's availability endpoint in parallel, server-side.

### Mobile

```bash
cd mobile/mobile-app
cp .env.example .env
npm install
npm run android   # or npm run ios / npm run web
```

See [mobile/mobile-app/README.md](mobile/mobile-app/README.md) for details.

---

## 🗺️ Roadmap & Known Limitations

Kept here deliberately, not swept under the rug:

- **No API gateway yet.** Each service independently enforces CORS/JWT/rate limiting. Revisit (e.g. YARP) once cross-cutting concerns outgrow per-service handling.
- **Umbraco's Postgres provider** (`Our.Umbraco.PostgreSql`) is a well-regarded **community** package, not officially maintained by Umbraco HQ. Two undocumented quirks it required: the connection string's provider name must be `Npgsql2` (not `Npgsql`), and `Umbraco:CMS:Global:UseHttps` must be explicitly `false` for the backoffice OAuth login to work over plain HTTP in local dev.
- **Two transitive vulnerability warnings** (`Microsoft.OpenApi`, `SQLitePCLRaw`) from Umbraco.Cms's own dependency tree. Not exploitable via anything wired up here (SQLite isn't used; the flagged OpenAPI path is Umbraco's internal backoffice Swagger), but worth checking on each Umbraco patch release.
- **AI recommendations personalize on limited signal** — titles, venue, and virtual/in-person flag (what Events.Api's own database holds). Richer personalization would mean pulling Umbraco's event summary/description too, deliberately deferred to avoid a live cross-service call on every recommendation request.
- **Event authoring is split across two systems** — `POST /api/events` (Events.Api) creates the transactional record (dates, venue, capacity), and Umbraco's `eventPage` content type (auto-created on first boot, see `cms/AuraEvents.Umbraco/Composing/EventContentTypeComposer.cs`) holds the editorial copy, linked by `systemEventId`. The organizer "new event" page (`frontend/web-app/src/app/organizer/new-event`) currently only drives the AI copy step; wiring it to actually call both and publish is still manual.
- **Mobile app is intentionally minimal** — plain React state for navigation (no router library), the QR code is a deterministic visual mockup (not a real scannable code), and there's no registration screen yet (only login) — new users must register via the web app first.
- **No self-service role promotion** — `Organizer`/`Admin` roles can only be granted by inserting directly into `user_roles` in Postgres; there's no admin UI or endpoint for it yet.
- **Dev-network TLS quirk (NetFree)**: if your network runs a filtering proxy that re-signs HTTPS (e.g. NetFree, common on Israeli ISPs), outbound calls from inside Docker containers (like Events.Api → OpenAI) will fail TLS chain validation even though the same call works fine from the host — the container doesn't trust the proxy's root CA the way Windows does. `src/services/Events.Api/Dockerfile` trusts `src/certs/netfree-ca-bundle.pem` to work around this locally. **This should not be needed in any real deployment** (staging/production networks don't route through a home filtering proxy) — if a future environment hits the same class of error, it means *that* network is intercepting TLS too, and the fix is to add *that* network's CA bundle, not to assume this one still applies. Safe to leave in the image either way: unused trusted roots are inert, they don't weaken anything.
- `frontend/web-app` has its own nested `.git` (from `create-next-app`), since the AuraEvents root isn't a git repo yet — worth resolving before running `git init` at the root, so it doesn't silently become an empty gitlink.
