# AuraEvents — Step 3: Registration QR Tickets, and Fixes Found Along the Way

Status: **FINALIZED**

## 0. Context

This step adds a QR-code ticket to event registration, per the original ask: generate a unique
code on successful registration, archive it in Umbraco Media, and let the user view/download it
securely right away and later from "My Registrations" / the mobile app. Email delivery was
explicitly out of scope (no SMTP/SendGrid infra exists anywhere in the repo).

While wiring this up and testing it live, three unrelated pre-existing bugs surfaced and were
fixed in the same pass (§4), plus one adjacent, explicitly-requested feature (editing an event's
hero image after creation, §5) that the ticket work's Umbraco-media plumbing made straightforward
to add.

---

## 1. Ticket QR — architecture

- **`TicketCode`, not `RegistrationId`, is what's encoded in the QR.** `EventRegistration` gained
  `TicketCode` (opaque random token, base64url of 16 random bytes), `QrMediaKey`, `QrSyncError`
  (`src/services/Events.Api/Entities/EventRegistration.cs`). Keeping the QR payload distinct from
  the id already used in ordinary API URLs means a scanned/leaked QR isn't equivalent to a bearer
  credential embedded in routine links.
- **The PNG is regenerated on demand, not read back from Umbraco Media.** Since the image is fully
  deterministic from `TicketCode`, `QrCodeService.GeneratePngBytes` (QRCoder) renders it fresh on
  every request. This means display never depends on Umbraco being up, and there's no need to
  proxy binary reads through the Management API. Umbraco Media upload is a **best-effort archival
  step only** — mirrors the existing `UmbracoSyncError` pattern from event-content publishing
  (`EventsController.CreateAndLinkUmbracoContentAsync`): registration itself never fails because of
  an Umbraco Media hiccup, and a failure is surfaced as `RegistrationResponse.QrSyncError` instead.
- **No new Umbraco content/document type.** `UmbracoMediaService` uploads into Umbraco's built-in
  `Image` media type, whose key is resolved once via `GET /item/media-type/search?query=Image` and
  cached (`UmbracoImageMediaTypeResolver`, same cache-with-lock shape as `UmbracoTokenProvider`) —
  avoids hardcoding a media-type key that could differ per environment (the same class of gotcha
  `docs/testing/umbraco-swagger-verification.md` already documents for `EventPageDocumentTypeKey`).
  The two-step upload contract (`POST /temporary-file` then `POST /media`) was verified against
  this project's live Umbraco 17 swagger spec and then actually exercised end-to-end — see that
  doc's 2026-07-05 addendum for the confirmed request/response shapes.
- **Secure display = existing JWT auth, not Umbraco media privacy.**
  `GET /api/events/{eventId}/registrations/me/qr` (and an organizer variant keyed by
  `registrationId`) return the PNG directly — the raw Umbraco media URL is never exposed to the
  frontend. A cancelled registration's ticket returns **410 Gone** (`TICKET_CANCELLED`), mirroring
  the existing `EventStatus.Cancelled`/`Completed` → 410 pattern in `RegistrationsController`. A
  valid ticket's image is served with `Cache-Control: private, max-age=86400, immutable` and an
  `ETag` (the `TicketCode` itself) — it never changes while the ticket is valid, so the browser
  doesn't need to re-fetch/regenerate it on every page load.
- **`GET /api/events/{eventId}/registrations/tickets/manifest`** (Organizer/Admin) lists every
  non-cancelled registration's `TicketCode` for an event — the backend enabler for offline scanning
  at the door (poor connectivity is common at venues). Building the actual scanner client (mobile
  screen, camera library, offline persistence, check-in sync-on-reconnect) is a distinctly separate,
  larger effort — nothing like it exists yet in `mobile/mobile-app/` — so this endpoint just makes
  that follow-up possible without further backend changes.

**Full ticket view / download** (`frontend/web-app/src/app/tickets/[eventId]/page.tsx`): rather than
a bare QR PNG download, "download" opens a print-friendly page (event title, date, venue, price,
QR) with a "print / save as PDF" button (`PrintButton.tsx`, `window.print()`). The page's own
`<title>` (set via `generateMetadata`, e.g. "כרטיס — AuraEvents Launch Night") becomes the browser's
suggested save-as filename — this was a deliberate substitute for a `download="ticket-<GUID>.png"`
attribute, which produced GUID-named files with no event details.

## 2. Where the QR shows up

- **Web**: inline right after registering (`RegisterButton.tsx`) and from "My Registrations"
  (`MyRegistrationRow.tsx`, toggled), both linking through to the full `/tickets/{eventId}` view.
- **Mobile** (`mobile/mobile-app`): `QrCodeScreen.tsx` now renders the real ticket via
  `<Image source={{ uri, headers: { Authorization } }}>` (RN's `Image` supports per-request
  headers, unlike a plain web `<img>`), replacing the old `MockQrCode.tsx` placeholder — deleted,
  since it's now unused. See §4.3 for why this mattered beyond just "the mockup looked fake".

## 3. New NuGet dependency

`QRCoder` (MIT, pure managed code, no native deps) — `src/services/Events.Api/Events.Api.csproj`.

---

## 4. Bugs found and fixed while testing this live

### 4.1 Every event card linked to the same wrong URL

`frontend/web-app/src/lib/umbraco.ts` built each event's `slug` from
`item.route.startItem.path` — verified directly against the live Umbraco Delivery API that this
field is **not** per-item: it's the shared domain/site root's own path ("events" for literally
every event under that root). Every "פרטים והרשמה" link on the homepage pointed at `/events`
regardless of which card was clicked. Fixed to use `item.route.path` (trimmed of slashes), which
**is** the item's own route (e.g. `/auraevents-launch-night/`) — confirmed by hitting
`/umbraco/delivery/api/v2/content/item/<path>` for both values before and after the fix.

### 4.2 Hebrew event titles collapsed to the same slug, causing false "already exists" conflicts

`frontend/web-app/src/lib/slugify.ts` strips everything outside `a-z0-9`, then falls back to the
literal string `"event"` if nothing survives. Since this app's UI (and presumably most event
titles) are Hebrew, *every* Hebrew-titled event slugified to `"event"` — the second event a user
ever created would 409 with `SLUG_ALREADY_EXISTS` deterministically, not as an edge case. Fixed by
always appending a short random suffix (`crypto.randomUUID()` fragment) regardless of what the
ASCII-sanitized base looks like, so every event gets a unique slug independent of the title's
script. (Note: this Postgres-side `Slug` is a uniqueness key only — actual page routing uses
Umbraco's own per-item route, per §4.1; the two are independent values that happened to look
related.)

### 4.3 Mobile "My Events" showed a raw GUID instead of the event title

`GET /api/users/me/registrations` (`MyRegistrationResponse`) never included the event's title, so
`mobile/mobile-app/src/screens/EventsScreen.tsx` rendered `item.eventId` (a GUID) as the card
heading — there was no title anywhere to show. The web dashboard masked the same underlying gap
with a separate Umbraco content lookup + GUID fallback. Fixed at the source: the endpoint now
projects `r.Event.Title` as `EventTitle` (`RegistrationsController.GetMyRegistrations`), and both
the mobile `EventsScreen.tsx` and the web `dashboard/page.tsx` consume it directly instead of
falling back to raw ids.

## 5. Adjacent feature: editing an event's hero image after creation

`EventsController.UpdateEvent`'s own doc comment says title/slug/editorial content are Umbraco's
domain and aren't editable via that endpoint — hero image is one of those editorial fields, and
until now there was no way to change it post-creation at all (only set once, at creation time).

Added `PUT /api/events/{eventId}/hero-image` (Organizer who created the event, or Admin; 409 if the
event has no published Umbraco content yet to attach an image to). Implementation
(`IUmbracoContentService.UpdateHeroImageAsync`) **fetches the document's current `values`/`variants`
via `GET /document/{id}` first**, replaces only the `heroImage` entry, and PUTs the merged set back
— `PUT /document/{id}` is a full replace of `values`, so resending everything unchanged except the
one field that's actually changing is what prevents the update from silently wiping
`summary`/`description`/`seoTitle`/`seoDescription`. Verified live: updated an event's image and
confirmed via the Delivery API that the other four fields were untouched.

`EditEventForm.tsx` gained an image field + preview + its own "שמירת תמונה" action (independent of
the logistics form's submit, since it hits a different endpoint) — wired through a new Next.js
proxy route (`api/events/[eventId]/hero-image/route.ts`) and a shared `fileToBase64` helper
(`lib/files.ts`, extracted from `NewEventForm.tsx` since both forms now need it).
