# `viewCount` counts every visit, not unique viewers

## Context

`ListingView` was unique on `(listingId, viewerKey)` — `recordView` only wrote a row (and only
incremented `Listing.viewCount`) the *first* time a given viewer (`user:<id>` or `anon:<uuid>`)
looked at a listing; every repeat view was a silent no-op. Decided instead: track every visit —
who (`viewerKey`) and when (`createdAt`) — and let `viewCount` reflect total visits, not distinct
visitors.

**Why the raw-log shape, not the deduped one**: it's the more information-preserving choice. A
unique-viewer count can always be recovered later from a raw visit log (`count(distinct
viewerKey)` over `ListingView` rows) if that's ever wanted back — but a table that only ever kept
the first view per viewer can never reconstruct how many times each viewer actually returned. Kept
this row so future-you doesn't have to re-derive it: dedupe at *read* time, not *write* time, so
the choice stays reversible.

## What changed

- **Schema** (`apps/bff/prisma/schema.prisma`): `ListingView` dropped
  `@@unique([listingId, viewerKey])` in favor of a plain `@@index([listingId, viewerKey])` — same
  columns, same query performance for listing-scoped lookups, just no longer enforced unique.
  Migration: `apps/bff/prisma/migrations/20260915133853_listing_view_track_every_visit/`.
  **Hand-written, not generated** — no reachable local Postgres to run `prisma migrate dev`
  against at the time this was written; verify it applies cleanly (`prisma migrate deploy` against
  a dev DB, then `prisma migrate status`) before this reaches anywhere real, same caveat as the
  still-unresolved missing migration flagged in `docs/plans/instant-alerts-paid-message-
  notifications.md`'s deploy notes.
- **`ListingsService.recordView`**: no more `try/catch`-on-`P2002` dedup — always `create`s a row
  and always increments `viewCount`.
- **`ListingsService.linkListingViewsToUser`**: simplified from upsert-then-delete to a plain
  `updateMany` rename, now that a rename can't collide with an existing row (see
  `docs/plans/link-anonymous-views-to-account-on-signup.md`, updated to match).

## Known consequence, not yet addressed

`ListingsService.listEngagement` (the admin "Liked & Viewed" table) reads `ListingView` rows
filtered to `viewerKey: {startsWith: 'user:'}`. Its own doc comment already tolerated a user
appearing twice ("liked and viewed are two different rows") — but now a single user hitting
refresh 20 times shows up as 20 rows in that table, crowding out other distinct viewers on a page.
Not fixed here (out of scope for this change); if that admin table should show one row per
*distinct* viewer rather than one per visit, that's a `distinct: ['viewerKey']` (or a `groupBy`)
added to its query — a read-time dedup, deliberately not a write-time one, consistent with the
reasoning above.

## Verification

- `pnpm --filter bff typecheck` (already run; `prisma generate` was re-run against the edited
  schema so the client's types match — no DB connection needed for that step).
- View the same listing twice, logged out: confirm two `ListingView` rows, `viewCount` at 2 (not
  deduped to 1 as it would have been before).
- Sign up after a few anonymous views: confirm `linkListingViewsToUser`'s rename doesn't error even
  when a `user:<id>` row for the same listing already exists from an earlier logged-in view.

## Critical files

- `apps/bff/prisma/schema.prisma`, new migration
  `20260915133853_listing_view_track_every_visit/migration.sql`
- `apps/bff/src/listings/listings.service.ts` (`recordView`, `linkListingViewsToUser`)
- `docs/plans/link-anonymous-views-to-account-on-signup.md` (updated to match)
