# AuraEvents — Step 2: Categories, Event Organization, Editing, and Hero Images

Status: **FINALIZED**

## 0. Context

`01-system-architecture.md` established the split between Umbraco (editorial content) and
Postgres/`Events.Api` (transactional data). This document covers four additions built on top of
that split: a category taxonomy for events, organizing `eventPage` content under an "Events"
folder, letting organizers edit events they created, and an event hero image.

---

## 1. Categories — hybrid Umbraco/Postgres design

A generic Umbraco pattern (Multi-Node Tree Picker, `IContentService` calls from `Events.Api`)
would violate the rule in §0/§3.1 of `01-system-architecture.md`: transactional/filterable data
lives in Postgres, not Umbraco. Categories are filtering data, so the design is a **hybrid**:

- **Umbraco is the source of truth for the category tree** — hierarchical, editable in the
  backoffice under a "Categories" root folder (`categoryFolder` → `categoryItem`, nestable
  arbitrarily deep for sub-categories).
- **Postgres is a synced read-cache** (`categories`, `event_categories` tables in
  `Events.Api`'s database) so event filtering never calls out to Umbraco per request.
- **Events can have multiple categories** (`event_categories` join table).
- Sync flows **one way**, through Umbraco's own publish/delete notifications
  (`CategorySyncNotificationHandler` in `cms/AuraEvents.Umbraco/Composing/`), so it doesn't matter
  whether a category was created via the backoffice tree or via the frontend-facing
  `POST /api/categories` endpoint — both end up publishing a `categoryItem` node in Umbraco, and
  the same notification handler pushes it to Postgres via `PUT /api/internal/categories/sync`
  (shared-secret header, not a user JWT).

**Edge cases handled:**
- *Out-of-order publish notifications* (a parent + child category published together can arrive
  in either order): the handler sorts by `content.Level` before syncing, and `categories.parent_id`
  is `DEFERRABLE INITIALLY DEFERRED` as a DB-level safety net.
- *Cascading delete*: deleting/unpublishing a parent category soft-deletes (`is_active = false`)
  it and every descendant via a recursive CTE in `CategoriesController.DeleteCategory`, since
  Umbraco's delete notification isn't guaranteed to enumerate every descendant individually.
- *Frontend-created categories* (`POST /api/categories`, Organizer/Admin only): calls
  `IUmbracoContentService.CreateAndPublishCategoryAsync` to create+publish in Umbraco, **and**
  synchronously upserts Postgres in the same request — the async notification sync will upsert the
  identical row again moments later, which is harmless, but without the synchronous write the new
  category wouldn't be usable as a `categoryId` on the same event-creation request.

Fixed content-type/folder keys (`CategoryItemContentTypeKey`, `CategoriesRootFolderKey`, etc. in
`CategoryContentTypeComposer.cs`) let `Events.Api` address Umbraco nodes without a runtime lookup —
same pattern as `EventPageDocumentTypeKey`, including the same "only applies on a fresh database"
gotcha (see `docker-compose.yml`'s `UMBRACO_CATEGORIES_ROOT_FOLDER_KEY` override).

---

## 2. Events folder

`eventPage` nodes now live under a dedicated "Events" folder (`eventsFolder` content type) instead
of scattered at content root — mirrors the Categories folder for backoffice tidiness.
`EventContentTypeComposer.cs` flips `eventPage.AllowedAsRoot` to `false` even on already-provisioned
databases (not just fresh ones), and `UmbracoContentService.CreateAndPublishEventPageAsync` passes
`EventsRootFolderKey` as the `parent` on every new event.

---

## 3. Editing events

Organizers can edit the events they created — but only the transactional Postgres fields (dates,
venue, capacity, price, status, categories), not title/slug/editorial content, which stay Umbraco's
domain per the existing architecture split.

- `PUT /api/events/{eventId}` (`OrganizerOrAdmin` policy) — checks `event.CreatedByUserId` against
  the caller's `sub` claim (Admins bypass this check); `403 FORBIDDEN` otherwise.
- `GET /api/users/me/events` — powers the dashboard's "my events" list, the only surface that
  links to the edit page (the edit page itself doesn't re-check ownership for rendering, since
  `GetById` is already public read — only the `PUT` mutation is protected).

---

## 4. Hero images

Event creation supports an optional photo, uploaded through Umbraco's Media API and rendered on
event cards and the detail page.

**Verified request/response shapes** (against this project's own running Umbraco 17 instance, same
methodology as `docs/testing/umbraco-swagger-verification.md`):
- Upload: `POST /temporary-file` (multipart, fields `Id` + `File`) → `POST /media` referencing
  `{ alias: "umbracoFile", value: { temporaryFileId } }`, `mediaType.id` = Umbraco's well-known
  built-in "Image" media type key (`cc07b313-0843-4aa8-bbda-871c8da728c8`, identical across every
  Umbraco install — not environment-specific).
- Attaching to `eventPage`: **`PUT /document/{id}` is a full replace of `values`** — aliases
  omitted from the array get wiped, not left alone (confirmed empirically: omitting
  `systemEventId` on an update blanked it to `""`). `UmbracoContentService.AttachHeroImageAsync`
  therefore always resends every existing property value alongside `heroImage`, then re-publishes
  (the update alone only touches the draft).
- MediaPicker3's stored/delivered value is an array:
  `[{ key, mediaKey, mediaTypeAlias: "Image", crops: [], focalPoint: null }]` on write; the
  Delivery API resolves it to `[{ url, width, height, extension, ... }]` on read — `url` is
  relative to the Umbraco origin, not the Next.js one (`lib/umbraco.ts` prefixes it).

A failed image attach doesn't fail event creation — it's logged and the event still gets created
and published without the image, since the photo is a nice-to-have, not required for the event to
exist.
