# Finish listing-renewal UI + add renewal history

## Context

`docs/plans/listing-expiry-renew-past-listings.md` was implemented backend-only: the BFF has
`PATCH :id/renew` (`listings.controller.ts:80`), `ListingsService.renew()`
(`listings.service.ts:565`), and the slot-cap-excluding `assertCanRenew`
(`listing-slots.service.ts:61`), plus the web-side plumbing (`renewListing()` in `bff.ts:211`,
`renewListingAction()` in `actions/listings.ts:98`, shared `daysUntil()` in
`lib/listingExpiry.ts`). Nothing in the UI calls any of it yet — `/my-listings`
(`apps/web/src/app/my-listings/page.tsx`) has no `RenewButton`, no expiry countdown, and no
Active/Past split. This plan finishes that UI.

Separately, `renew()` currently just overwrites `expiresAt` in place — confirmed by reading the
code, there is no `ListingRenewal`/audit table, no `renewCount`, no `lastRenewedAt` anywhere in
`schema.prisma`. Once a listing is renewed twice, there's no way to answer "how many times, and
from what date to what date." This plan adds that as an audit-log side effect of `renew()`,
following the exact pattern `ListingBoost` already uses as boost's audit trail
(`schema.prisma:504` — a `Listing`-scoped model recording a from/to pair with `@default(now())`)
denormalized alongside the flag/count actually used by the UI.

## Design

### 1. Schema: `ListingRenewal` audit table

Add to `schema.prisma`, mirroring `ListingBoost`'s shape:

```prisma
model ListingRenewal {
  id                String   @id @default(cuid())
  listingId         String
  listing           Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  previousExpiresAt DateTime
  newExpiresAt      DateTime
  renewedAt         DateTime @default(now())

  @@index([listingId])
}
```

Add `listingRenewals ListingRenewal[]` to `Listing`. Run
`pnpm --filter @bhavano/bff prisma migrate dev --name add_listing_renewals` against the local dev
DB (`apps/bff/.env` already points at `localhost:5432`) to generate the migration the same way
the existing `20260728130000_listing_slots_and_notifications` migration was generated — not
hand-written SQL.

### 2. BFF: write the audit row, expose it read-only

- `ListingsService.renew()` (`listings.service.ts:565`): replace the single
  `prisma.listing.update` with `prisma.$transaction([...])` — one `listing.update` for
  `expiresAt`, one `listingRenewal.create` with `{ listingId: id, previousExpiresAt:
  existing.expiresAt, newExpiresAt }` — so the audit row can never diverge from the actual bump.
  This is the first `$transaction` use in the codebase; array form is sufficient here (no
  interdependent reads between the two writes).
- `LISTING_MEDIA_INCLUDE` (`listings.service.ts:94`, already spread at every `findMany`/
  `findUnique`/`update` call site): add
  `listingRenewals: { orderBy: { renewedAt: 'desc' as const } }`. Renewals are rare (0 rows for
  the overwhelming majority of listings), so this is a cheap join everywhere, same tradeoff
  already accepted for `owner: { select: { agentProUntil } }` being fetched unconditionally for
  video entitlement.
- `toDetailDto()` (`listings.service.ts:747`): add
  `renewCount: listing.listingRenewals.length` and
  `renewalHistory: isOwnerOrAdmin ? listing.listingRenewals.map(r => ({ from:
  r.previousExpiresAt.toISOString(), to: r.newExpiresAt.toISOString(), renewedAt:
  r.renewedAt.toISOString() })) : undefined` — same owner/admin gate already used for
  `videoEntitlement` just above it. Not added to `ListingCardDto`/`toCardDto` — browse cards don't
  need it.
- `packages/types/src/index.ts`: extend `ListingDetailDto` with
  `renewCount: number; renewalHistory?: { from: string; to: string; renewedAt: string }[];`.
- `apps/bff/src/listings/listings.service.spec.ts`: add a `describe('renew — ...')` block
  (mirroring the existing `makeService()` helper) covering: happy path calls `$transaction` with
  an update + a create carrying the right `previousExpiresAt`/`newExpiresAt`; rejects a
  non-`active` listing with `BadRequestException`; rejects a non-owner; propagates
  `assertCanRenew`'s `ForbiddenException` when at cap.

### 3. Web: `RenewButton` + expiry countdown + Active/Past split + renewal history display

- New `apps/web/src/components/home/RenewButton.tsx` (client component, modeled on
  `BoostButton.tsx` minus the Razorpay step — no payment involved): calls `renewListingAction`;
  on `ListingSlotCapError`/cap-reached result, shows the identical "You're at your limit…
  upgrade for more slots" copy/link `ListingSlotMeter.tsx:15-22` already uses; on success,
  `router.refresh()`.
- `apps/web/src/app/my-listings/page.tsx`:
  - Split `listings` into `activeListings` (`!item.isExpired`) and `pastListings`
    (`item.isExpired`) inside `MyListingsGrid`; render the existing list under the current
    heading, then a "Past listings" heading + list below when `pastListings.length > 0`.
  - In `MyListingRow` (`page.tsx:95`): when `item.status === 'active' && daysUntil(item.expiresAt)
    <= 7` (covers both the pre-expiry window and any time after, per the existing plan doc),
    render "Expires in {n} days" (or "Expired") next to the status badge, plus
    `<RenewButton listingId={item.id} />` in the action row alongside `BoostButton`/View/Edit.
  - When `item.renewCount > 0`, render a small muted line — "Renewed {n} time{s} · last on
    {formatted lastRenewedAt}" (derived from `item.renewalHistory[0].renewedAt`, since it's
    already sorted newest-first) — directly answering "how many times / from what date to what
    date" in the UI itself rather than requiring a separate history view.

## Verification

- `pnpm --filter @bhavano/bff prisma migrate dev --name add_listing_renewals` applies cleanly
  against the local dev DB.
- `pnpm --filter @bhavano/bff test` — existing 53 tests plus new `renew()` specs green.
- `pnpm --filter @bhavano/bff typecheck` and `pnpm -w typecheck`.
- Manual: set a test listing's `expiresAt` to 3 days out — `/my-listings` shows "Expires in 3
  days" + a Renew button. Click it twice (waiting/adjusting dates between clicks) — confirm
  "Renewed 2 times · last on {today}" appears and `expiresAt` moved by 30d each time.
- Manual: push a seller to their slot cap, renew an already-active listing within the 7-day
  window — confirm it succeeds; renew an expired one while still at cap — confirm the same
  upsell message `ListingSlotMeter` shows.
- Per repo convention (`CLAUDE.md`), save this plan to
  `docs/plans/finish-listing-renewal-ui-and-history.md` once approved.
