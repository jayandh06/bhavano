# Listing expiry: renew action + Past listings

## Context

Today, once a listing's `expiresAt` passes, nothing happens to it beyond quietly vanishing from
public surfaces — no in-app action, no visibility on the owner's own `/my-listings` page beyond a
plain red "Expired" badge next to the title. Confirmed by reading the current code:

- `ListingStatus` (`schema.prisma:29-34`) is only `active | sold | rented | deactivated` — there is
  no `expired` status value. Expiry is a pure computed flag,
  `isExpired = expiresAt.getTime() < Date.now()` (`listings.service.ts:756`), independent of
  `status`.
- `listMine()` (`listings.service.ts:508`) returns every listing the owner has, regardless of
  status or expiry, in one flat list — `/my-listings` (`apps/web/src/app/my-listings/page.tsx`)
  renders all of them together; an expired listing just gets `STATUS_LABELS`/`STATUS_COLORS`
  overridden to a red "Expired" tag (`page.tsx:105`). **No expiry countdown is shown anywhere on
  this page today** — the only place `daysUntil(expiresAt)` is rendered is the public listing
  detail page (`ListingDetailView.tsx:9,112`), not the owner's own management page.
- **No renew action exists anywhere** — no endpoint, no button, no cron-driven extension. The
  owner-facing `UpdateListingDto` (`update-listing.dto.ts`) only allows changing
  `price/priceQualifier/title/specs/attributes/status` — never `expiresAt`.
- **No delete/soft-delete of a listing exists at all** — `listings.controller.ts` has no
  `DELETE :id` route (only `DELETE :id/videos/:videoId`). A listing row is permanent once created;
  expiry only ever affects *visibility* (`list()`, `getPopularSearches()`, `findAllForSitemap()`
  all filter `status:'active', expiresAt:{gt:now}`), never removal.
- `ListingSlotsService.countActiveListings()`/`activeListingWhere()`
  (`listing-slots.service.ts:13-23`) already excludes expired listings from the slot-cap count —
  so a listing silently frees up a slot the moment it lapses, even though `status` is still
  nominally `'active'`.
- The only existing owner-facing expiry touchpoint is `ListingExpiryReminderJob`
  (`apps/bff/src/seller-jobs/listing-expiry-reminder.job.ts`) — an email/SMS reminder at 7 days and
  1 day before expiry. No in-app equivalent, and no action attached to it.

**Decisions confirmed with the user:**
- **"Past listings", not soft-delete.** An expired-and-unrenewed listing is already fully invisible
  everywhere except the owner's own `/my-listings` page and already excluded from the slot count —
  introducing a new deleted/archived concept would touch the admin panel, moderation flows, and
  every `ListingStatus` enumeration for no real gain. Instead, `/my-listings` splits into an
  **Active** section and a **Past listings** section, purely a client-side grouping by the
  already-computed `isExpired` flag — no schema change.
- **Manual "Renew" button**, surfaced starting **7 days before expiry** (mirroring the existing
  reminder job's 7-day threshold) through to any time after actual expiry — not only after it
  lapses. Renewing pushes `expiresAt` forward by the same `DEFAULT_LISTING_DURATION_DAYS` (30) used
  for a fresh post, gated by the existing slot-cap logic so a seller can't renew past their limit.

## Design

### 1. BFF: renew endpoint + cap check that excludes the listing being renewed

`ListingSlotsService.assertCanPublish()` (`listing-slots.service.ts:47`) can't be reused as-is for
renewal: a **not-yet-expired** listing being renewed early is *already* counted in
`countActiveListings()`, so checking the cap without excluding it would block a seller at their cap
from renewing any of their own still-active listings — even though renewing doesn't add a new slot.

- Add `countActiveListings(ownerId, excludeListingId?)` (extend the existing method's `where` with
  an optional `id: { not: excludeListingId }`) and a new `assertCanRenew(ownerId, listingId)` that
  mirrors `assertCanPublish` exactly, but counts against that exclusion — same
  `ListingSlotCapErrorBody` shape/upsell logic, so the frontend's existing cap-reached handling
  works unmodified.
- `ListingsService.renew(listingId, ownerId)` (new, alongside `update()`/`getMine()`):
  ownership check identical to `update()`'s; reject with `BadRequestException` if
  `status !== 'active'` (renewing a sold/rented/deactivated listing makes no sense — Renew only
  ever shows for active ones in the UI, but the backend enforces it too); call
  `listingSlotsService.assertCanRenew(ownerId, listingId)`; compute
  `newExpiresAt = max(now, listing.expiresAt) + DEFAULT_LISTING_DURATION_DAYS days` (the `max`
  makes one formula correct for both the pre-expiry window, where it stacks onto the remaining
  time, and post-expiry, where the old date is already in the past); `prisma.listing.update`; return
  `toDetailDto(...)`.
- `ListingsController`: `PATCH :id/renew` (`AuthGuard`), mirroring the existing `PATCH :id` route.

### 2. Web: Renew button + expiry countdown + Past listings section

- `apps/web/src/lib/bff.ts`: new `renewListing(accessToken, listingId)` using the existing
  `bffFetch` wrapper — it **already** translates any `LISTING_SLOT_CAP_REACHED` 403 into a
  `ListingSlotCapError` generically (`bff.ts:67-73`), so no new error-plumbing is needed.
- `apps/web/src/app/actions/listings.ts`: new `renewListingAction(listingId)`, mirroring
  `createListingAction`'s existing `catch (error) { if (error instanceof ListingSlotCapError) ... }`
  pattern (`listings.ts:34-38`) — same `{success:false, error, slotCap}` shape.
- New `apps/web/src/lib/listingExpiry.ts` exporting the `daysUntil(iso)` helper currently
  private to `ListingDetailView.tsx:9` — both that file and `my-listings` need the identical
  calculation now, worth one shared implementation instead of two.
- New `apps/web/src/components/home/RenewButton.tsx` (client component, same shape as
  `BoostButton.tsx` minus the Razorpay checkout step — no payment involved): calls
  `renewListingAction`; on cap-reached, shows the same "You're at your limit… upgrade for more
  slots" copy/link pattern already used by `ListingSlotMeter.tsx:15-22`; on success,
  `router.refresh()`.
- `apps/web/src/app/my-listings/page.tsx`:
  - Split `listings` into `activeListings` (`!isExpired`) and `pastListings` (`isExpired`); render
    the existing list under the current heading, then a new "Past listings" heading + list below
    it using the same `MyListingRow`.
  - In `MyListingRow`, when `item.status === 'active' && daysUntil(item.expiresAt) <= 7` (true for
    both the 7-day pre-expiry window and any time after, since a negative value still satisfies
    `<= 7`), render "Expires in {n} days" (or "Expired" — the existing badge already says that)
    alongside `<RenewButton listingId={item.id} />`, replacing today's silence/dead-end.

## Verification

- `pnpm --filter @bhavano/bff typecheck` and `pnpm -w typecheck`.
- Manual: set a test listing's `expiresAt` to 3 days out — confirm `/my-listings` now shows
  "Expires in 3 days" + a Renew button (nothing shown today). Click Renew, confirm `expiresAt`
  moves to `(old expiresAt) + 30d`.
- Manual: set `expiresAt` to a past date — confirm the listing moves into "Past listings" and
  still offers Renew; click it, confirm `expiresAt` becomes `now + 30d`.
- Manual: push a seller to their slot cap (5 free-tier active listings), then try renewing an
  already-active listing within the 7-day window — confirm it succeeds (the listing being renewed
  is excluded from its own cap check) — then try renewing an *expired* one while still at cap —
  confirm that one is blocked with the same upsell message `ListingSlotMeter` already shows.
- Manual/curl: attempt `PATCH :id/renew` directly on a `deactivated`/`sold` listing — confirm
  `BadRequestException`, independent of the UI gating.
