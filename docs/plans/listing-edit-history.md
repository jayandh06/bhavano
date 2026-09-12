# Listing edit history — who changed what, and when

Before this, there was no way to answer "what changed on this listing, who did it, and when"
beyond a single `updatedAt` timestamp (overwritten on every edit, no diff) and `moderatedAt`
(when a moderation action last happened, with no "by whom" at all). `ListingRenewal` is the only
real history table that existed, and it's narrowly scoped to expiry-date renewals.

## Schema

`ListingEditLog` — one row per mutation:

| Field | Purpose |
|---|---|
| `actorType` | `'owner'` \| `'admin'` \| `'system'`. Plain string, not an enum — same reasoning as `ListingNotificationLog.kind`: a new actor type never needs a migration. |
| `actorId` | A real `User.id` for `'owner'` and `'admin'` — an owner editing their own listing and an admin moderating someone else's are both real `User` rows, just different roles for this one action. Null for `'system'`. |
| `action` | `'created'` \| `'updated'` \| `'approved'` \| `'flagged'` \| `'status_changed'` \| `'photo_added'` \| `'photo_removed'` \| `'video_added'` \| `'video_removed'`. |
| `changes` | `{ fieldName: { before, after } }`, JSON since different actions touch completely different field shapes. Null only for `'created'` (nothing to diff against) and the photo/video actions (see below). |

## What's tracked

- **Owner edits** (`ListingsService.update`) — a generic `diffFields()` helper compares the
  pre-update row against the DTO's fields (price, priceQualifier, title, specs, description,
  attributes, status) and logs only the ones that actually changed value, with real before/after
  values. `JSON.stringify` comparison, not `!==` — `attributes` is an object, so reference
  inequality would flag it as "changed" on every edit even when its content is identical.
- **Listing creation** (`ListingsService.create`) — logged as `actorType: 'system'` when the
  owner is the bulk-import placeholder account (`BULK_IMPORT_OWNER_PHONE`, see
  `listings.service.ts`'s own note on that), `'owner'` otherwise. No `changes` — nothing to diff
  against yet.
- **Admin moderation** (`flag`/`approve`/`setStatusAsAdmin` in `ListingsService`, called from
  `AdminService`) — each now takes `adminId` (previously only `flag(id)`/`approve(id)`, no actor
  at all) and logs the `moderationState`/`status` before/after. `setStatusAsAdmin` only logs when
  the value actually changes (setting a listing to the status it's already at is a no-op, not an
  event).
- **Photos/videos** (`addPhoto`/`deletePhoto`/`addVideo`/`deleteVideo`) — logged as an event
  (`photo_added`, etc.) with `changes: null`. Not diffed field-by-field — "a photo was added" is
  the fact that matters here, not a before/after of an array of opaque storage keys.

## What's deliberately NOT tracked

- **`ListingsService.deleteListing`** — a hard delete cascades `ListingEditLog` away with the
  rest of the listing's rows (`onDelete: Cascade`), so writing a log entry right before deleting
  would just delete itself. An audit trail that must survive the listing being gone entirely
  needs a genuinely different, non-cascading design — out of scope here. (`deleteListing`'s own
  comment already notes a plain `logger.log()` line is emitted — that's an application log line
  for observability, not a persisted, queryable DB row.)
- **`recordView`/`toggleFavourite`** — buyer-side interactions, not listing mutations; that's what
  the existing "Liked & viewed" admin table already covers.
- **Renewals** — already covered by the pre-existing `ListingRenewal` table; not duplicated here.

## Reading it back

`ListingsService.listEditHistory(listingId, offset, limit)` → `GET
/admin/listings/:id/edit-history` → a "History" section on the admin listing detail page
(`apps/admin/src/app/listings/[id]/page.tsx`), paginated independently of the page's other two
paginated sections (Liked & viewed, Messages) via its own `historyPage`/`historyLimit` query
params, newest first.

`actorName` is resolved by joining `User` at read time, not stored denormalized on the log row —
so a later name change is reflected retroactively rather than freezing whatever the actor was
called when the action happened, the same tradeoff `ListingBoostDto.ownerName` already makes
elsewhere in this codebase.

## Verified

12 new backend tests: `diffFields`'s field-level diffing (only-changed-fields, JSON-content
comparison for `attributes`, no-op when nothing actually changed), `create()`'s `system`-vs-`owner`
actor split, and `flag`/`approve`/`setStatusAsAdmin`'s before/after logging including the
no-log-on-no-change case for `setStatusAsAdmin`. Not covered: the photo/video logging (no existing
test harness reaches those methods' full success path — see their own test file's fixture
requirements) or a browser click-through of the History UI (no existing test infrastructure for
admin pages).
