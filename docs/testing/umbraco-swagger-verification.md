# Verifying `UmbracoContentService` against the running Umbraco Management API

`src/services/Events.Api/Services/Umbraco/UmbracoContentService.cs` calls Umbraco's Management
API to create, publish, and delete `eventPage` documents. **This was verified directly against a
live Umbraco 17 instance on 2026-07-05** by fetching its real OpenAPI spec — no auth required for
the spec itself:

```bash
curl http://localhost:5003/umbraco/swagger/management/swagger.json
```

This closed every open question from the original draft and caught **two real bugs**, both fixed
in `UmbracoContentService.cs`.

## ⚠️ First: the content-type schema has exactly 5 fields, not more

Before anything else: the `eventPage` content type does **not** have `slug`, `eventDate`,
`location`, or `capacity` properties. Those are transactional fields that live only in
`Events.Api`'s Postgres `events` table (`Slug`, `StartAtUtc`/`EndAtUtc`, `VenueName`, `Capacity` —
see `src/services/Events.Api/Entities/Event.cs`). The actual Umbraco schema
(`cms/AuraEvents.Umbraco/Composing/EventContentTypeComposer.cs:56-79`) is only:

- `systemEventId` (TextBox, mandatory — the Postgres `Event.EventId`, as a string)
- `summary` (TextBox)
- `description` (TextArea)
- `seoTitle` (TextBox)
- `seoDescription` (TextArea)

This is deliberate — `docs/architecture/01-system-architecture.md` §3.1 documents that
start/end date and venue live in SQL only, to avoid two sources of truth. If a teammate's notes
list `eventDate`/`location`/`capacity` as Umbraco properties, that's a mix-up with
`CreateEventRequest`'s fields (the Postgres-side DTO), not the CMS content type.

## Bug #1 (fixed): publish used the wrong request body shape entirely

The real `PublishDocumentRequestModel` (from the live spec) is:

```json
{
  "publishSchedules": [
    { "culture": null, "schedule": null }
  ]
}
```

`publishSchedules` is a **required** top-level key. The code was sending `{ "variants": [...] }`
— a key that doesn't exist on this model at all — which would have failed publish with a 400 on
every single request. Fixed to send `publishSchedules` with one `{ "culture": null }` entry
(meaning: publish the invariant variant now, no schedule).

## Bug #2 (fixed): `template` is a required key on create, and was missing entirely

`CreateDocumentRequestModel`'s required keys are `documentType`, `template`, `values`, `variants`.
`template` is nullable (`"nullable": true` in the raw schema) but its **key must be present** in
the JSON body — OpenAPI's `required` means "key must exist," independent of whether the value is
allowed to be `null`. The code never included a `template` key at all. Fixed by adding
`template = (object?)null` to the create request.

## Confirmed facts (no longer speculative)

| Question | Answer |
|---|---|
| Create endpoint | `POST /umbraco/management/api/v1/document` |
| Publish endpoint | `PUT /umbraco/management/api/v1/document/{id}/publish` |
| Delete endpoint | `DELETE /umbraco/management/api/v1/document/{id}` |
| `values[]` — is `culture`/`segment` required per item? | **No.** Only `alias` is required on each `values[]` item; `culture`/`segment` are optional/nullable. The original draft payload (omitting them) was already correct. |
| `variants[]` — required fields? | Only `name`. `culture`/`segment` optional/nullable. |
| Client-supplied `id` on create | Accepted — `id` is an optional (`nullable: true`) UUID field on `CreateDocumentRequestModel`. |
| `parent: null` for root content | Accepted — `parent` is optional and nullable. |
| **Create response body** | **Empty.** The `201` response has *no JSON body* — only `Umb-Generated-Resource` and `Location` headers. This means a client-supplied `id` isn't just convenient, it's **required** to know the new document's key at all. `UmbracoContentService.cs`'s old `TryReadDocumentIdAsync` (which tried to parse a body that never exists) was dead code and has been removed; the client-generated `documentId` is used directly. |
| Delete semantics | **Confirmed hard delete.** Umbraco has a *separate* `POST /document/{id}/move-to-recycle-bin` endpoint for the soft-delete case — `DELETE /document/{id}` genuinely removes the document. No Recycle Bin follow-up is needed after `DeleteEventPageAsync`. |
| Auth mechanism | Security scheme `Backoffice-User` (OAuth2), token URL `/umbraco/management/api/v1/security/back-office/token` — matches what `UmbracoTokenProvider.cs` already calls. The spec's `securitySchemes` only lists the `authorizationCode` flow (used by the backoffice SPA), but `/umbraco/management/api/v1/user/{id}/client-credentials` and `/{clientId}` endpoints exist in this exact running version, confirming the API User / client-credentials feature used by our `client_credentials` grant is real and present — it's just not enumerated in the OpenAPI security metadata (that only documents the interactive flow). |

## ⚠️ Environment-specific gotcha: the fixed content-type key only applies to a *fresh* database

`EventContentTypeComposer.cs`'s `Key = EventPageDocumentTypeKey` fix only takes effect the first
time the `eventPage` content type is created (`if (contentTypeService.Get(Alias) is null)` is an
idempotency guard — once it exists, the composer never touches it again). On an
**already-provisioned** `auraevents_cms` database, the content type was created before this fix
existed and has whatever random key Umbraco originally assigned it.

Checked directly against the currently-running dev stack's Postgres:

```sql
SELECT n.id, n."uniqueId", n.text, ct.alias
FROM "cmsContentType" ct JOIN "umbracoNode" n ON ct."nodeId" = n.id
WHERE ct.alias = 'eventPage';
```
```
1056 | 504c1585-8e6e-44d6-a346-49dad257d124 | Event Page | eventPage
```

That's a different GUID than the composer's hardcoded `d2fa55b7-53fe-49b4-96dc-fdcb95bad0c4`. For
**this specific environment**, `Events.Api` must be configured with the real key, or every create
call will fail (document type not found):

```
UMBRACO_EVENT_PAGE_DOCTYPE_KEY=504c1585-8e6e-44d6-a346-49dad257d124
```

(`docker-compose.yml` already supports this override — it defaults to the composer's hardcoded
value but reads `UMBRACO_EVENT_PAGE_DOCTYPE_KEY` from `.env` first.) The alternative is dropping
and letting `auraevents_cms` reseed from scratch, which also wipes the demo "AuraEvents Launch
Night" content. For any **new** environment (fresh `docker compose up --build` with empty
volumes), the composer's hardcoded key is used from the start and no override is needed — this
gotcha is specific to environments provisioned before this fix landed.

---

## Rollback test: simulating a Postgres failure *after* Umbraco already published

This targets a specific failure window: Umbraco successfully creates **and** publishes the node,
but the follow-up Postgres write that links it (`Event.UmbracoContentKey`) then fails. Without
explicit handling this leaves a published-but-unlinked node in Umbraco forever, since nothing else
references it. `EventsController.CreateAndLinkUmbracoContentAsync` (in
`src/services/Events.Api/Controllers/EventsController.cs`) handles this by deleting the node via
`IUmbracoContentService.DeleteEventPageAsync` if the Postgres save throws.

### Why we don't literally kill the database mid-request

Timing a real `docker stop postgres` to land in the ~10ms window between the Umbraco publish call
returning and `SaveChangesAsync` executing isn't reliable. Instead, there's a small, explicit,
**Development-only** test seam: a `simulateDbFailureAfterUmbracoPublish` query flag on both
`POST /api/events` and `POST /api/events/{id}/umbraco-content`. It throws a synthetic exception at
exactly that point, but only when `IHostEnvironment.IsDevelopment()` is true — inert in any other
environment even if someone passes the flag.

### Step by step

1. Make sure Events.Api is running with `ASPNETCORE_ENVIRONMENT=Development` (the
   `docker-compose.yml` default), the Umbraco API User credentials in `.env` are correct, and (per
   the gotcha above) `UMBRACO_EVENT_PAGE_DOCTYPE_KEY` matches this environment's *actual* content
   type key if it's a pre-existing database — otherwise the Umbraco half fails for the wrong
   reason and you're not testing the rollback path at all.
2. Run `tests/http/event-creation-flow.http` Section 4 (`simulateRollback` request), or manually:
   ```
   POST http://localhost:5002/api/events?simulateDbFailureAfterUmbracoPublish=true
   Authorization: Bearer <organizer token>
   Content-Type: application/json

   { ...same body shape as Section 1.2... }
   ```
3. Expect a `201 Created` response with `umbracoContentKey: null` and `umbracoSyncError` set to
   the Hebrew "פרסום נכשל" message — the Postgres row exists (the event itself), but unlinked.
4. **Check the Docker logs**:
   ```bash
   docker compose logs events-api --tail=200
   ```
   With the success-path logging added to `UmbracoContentService.cs`, you should see, in order:
   - `Umbraco document <guid> created for event <guid>`
   - `Umbraco document <guid> published for event <guid>`
   - The simulated exception (`InvalidOperationException: Simulated DB failure after Umbraco publish...`)
   - `Umbraco content <guid> was published for event <guid> but linking it in Postgres failed — cleaning it up to avoid an orphaned node.`
   - `Umbraco document <guid> deleted`
   - **No** line reading `Failed to clean up Umbraco node <guid> for event <guid> after Postgres link failure — manual cleanup required in the backoffice.` — if that line *does* appear, the DELETE call itself failed (check the API User's permissions specifically; delete may need a broader grant than Create+Publish, which is all the README's setup section currently asks for).
5. **Confirm no orphan actually exists in Umbraco**:
   `GET http://localhost:5003/umbraco/delivery/api/v2/content?filter=contentType:eventPage` — the
   simulated event's `systemEventId` should **not** appear. (No Recycle Bin check needed — delete
   is confirmed hard, per the table above.)
6. **Confirm Postgres agrees**: `GET /api/events/{eventId}` (Section 4.1 in the `.http` file)
   should show `umbracoContentKey: null`.
7. **Confirm the system isn't stuck**: the retry endpoint (Section 4.2) should succeed normally
   afterwards and create a **new** Umbraco node — it never tries to "resume" the deleted one.

---

## Addendum (2026-07-05): ticket QR media upload, verified against the live stack

`UmbracoMediaService.cs` (`src/services/Events.Api/Services/Umbraco/UmbracoMediaService.cs`)
archives each registration's ticket QR PNG into Umbraco's built-in "Image" media type. The two-step
upload contract (`POST /temporary-file`, then `POST /media`) was inspected against the same cached
live swagger spec used above, and then **actually exercised end-to-end** against the running dev
stack (register for the seeded demo event via `POST /api/events/{eventId}/registrations`):

- `POST /umbraco/management/api/v1/temporary-file` (multipart, client-supplied `Id` + `File`) →
  `201`, empty body, same pattern as document create.
- `GET /umbraco/management/api/v1/item/media-type/search?query=Image` → resolves the built-in
  "Image" media type's key by matching `name == "Image"` (case-insensitive); cached in
  `UmbracoImageMediaTypeResolver` for the process lifetime.
- `POST /umbraco/management/api/v1/media` with body
  `{ id, parent: null, mediaType: { id: <imageMediaTypeId> }, values: [{ alias: "umbracoFile", value: { temporaryFileId } }], variants: [{ culture: null, segment: null, name }] }`
  → **confirmed `201`** on a real run (`docker compose logs events-api`:
  `Umbraco media <guid> created for registration <guid>`). The previously-untyped guess for the
  `umbracoFile` property's value shape (`{ temporaryFileId }`) was correct on the first live try —
  no further bugs found here, unlike the document create/publish endpoints above.
