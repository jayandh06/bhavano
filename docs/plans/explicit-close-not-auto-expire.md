# Stop auto-expiring listings — explicit close only

## Status: Implemented

Everything below landed as planned, plus two fixes the plan didn't anticipate:

- **Admin's listings table** (`apps/admin/src/components/AdminListingsTable.tsx`) had its own
  `isExpired`-driven "Expired" badge (red, overriding "Active") with a comment claiming "the
  public `list()` only ever shows approved, active, unexpired listings" — directly contradicted
  by the BFF change above, so it would have shown a false "Expired" status to the one audience
  responsible for actually closing a listing. Fixed to show the plain status label always.
- **`ListingDetailDto.isExpired` and `AdminListingRowDto.isExpired`** (`packages/types/src/
  index.ts`) and their computation in `apps/bff/src/listings/listings.service.ts` (`toCardDto`/
  `toDetailDto`) were removed outright once every consumer above was fixed — a repo-wide grep
  confirmed nothing else read them (the similarly-named `PropertyRequirement.isExpired` is a
  separate, independently-timed field and was left alone, per "Not doing" below).
- Two small BFF jest tests were added (`listings.service.spec.ts`, `listing-slots.service.spec.ts`)
  asserting the `where` clauses passed to Prisma never contain `expiresAt`, so a future change
  can't silently reintroduce the gate.

`tsc --noEmit` passes clean on bff/web/mobile/admin; bff jest is 801/803 (same 2 pre-existing,
unrelated failures as baseline); mobile jest is 67/67.

## Context

Today, every listing gets a flat `expiresAt = createdAt + 30 days` (`DEFAULT_LISTING_DURATION_DAYS`,
`apps/bff/src/listings/listings.service.ts:128`), and once that passes, the listing silently stops
appearing anywhere — browse/search, the sitemap, slot counting — with no status change at all
(`ListingStatus` has no `expired` value; it's purely a timestamp check). The only way to come back
is the existing "Renew" feature. The ask: stop this automatic disappearance entirely. A listing
should only ever leave the grid when the owner or admin **explicitly** closes it (sets `status` to
`sold`/`rented`/`deactivated`) — never just from age.

Confirmed with the user along the way:
- Slots should only free up on explicit close, never from age alone (intended, not a side effect
  to work around).
- Renew stays, as a purely optional action — not gated by any countdown, since nothing is actually
  at stake anymore.
- The daily "expires in 7/1 days" reminder email gets repurposed (see below), not deleted outright.
- **Closing a listing must stay a soft delete** — the row persists, the listing's own detail page
  (and its SEO value) must stay reachable by anyone, exactly as it works today. Confirmed by
  reading `findOne` (`listings.service.ts:1193`): it already 404s only on `moderationState ===
  'flagged'` or `publishState !== 'live'` — never on `status` or `expiresAt`. **This already does
  what's being asked — no code change needed here.** The only existing hard-delete in this codebase
  is `deleteExpiredAssistedListings` (unclaimed admin-assisted drafts) — an unrelated lifecycle,
  not touched by this plan.

## The critical thing this plan exists to catch

Browse/search already hide anything non-`active`, so simply removing the `expiresAt` filters
would be enough on its own for the grid. But **both web and mobile's listing detail pages
currently gate ALL contact/interest actions on `isExpired`, not `status`** — a listing past 30
days shows "This ad has expired and is no longer accepting responses" and hides the entire
contact UI, regardless of `status`. If only the grid filters were fixed, an old-but-still-active
listing would reappear in search, and clicking into it would still show "no longer accepting
responses" — silently defeating the entire point of this change. Both platforms need this fixed,
not just the BFF queries.

## BFF changes

1. **Drop the `expiresAt` visibility filter** in the three places it gates results:
   `list()` (`listings.service.ts:619`), `getPopularSearches()` (`:2608`),
   `findAllForSitemap()` (`:2640`) — remove `expiresAt: { gt: new Date() }` from each `where`,
   leaving `status: 'active', publishState: 'live', moderationState: 'approved'` as the only gates.
2. **Drop the same filter in slot counting** — `ListingSlotsService`'s `activeListingWhere`
   (`apps/bff/src/listing-slots/listing-slots.service.ts:26`): remove `expiresAt: { gt: now }`.
   This is what makes a slot only free up on an explicit status change, as confirmed.
3. **Leave `expiresAt` computation itself untouched** — creation (`:1523-1525`), claim (`:2517`),
   and `renew()` (`:2380-2414`) keep setting/extending it exactly as today. It still backs
   `instantAlertsUntil` and the Renew feature's own history — only its role as a *visibility gate*
   is being removed, not the field or the Renew mechanic.
4. **`update()`'s owner/admin status change is the soft-delete mechanism — confirm, don't touch.**
   No code change here; this section exists in the plan only so it isn't second-guessed later.
5. **`ListingExpiryReminderJob`** (`apps/bff/src/seller-jobs/listing-expiry-reminder.job.ts`) —
   repurpose rather than delete, since Renew stays as a real feature worth nudging toward:
   - Collapse the two-stage 7-days-before/1-day-before reminders into **one**, fired at the same
     point the old system would have made the listing disappear (`expiresAt <= now`, once —
     same `ListingNotificationLog` per-kind dedup pattern already in place, just one kind instead
     of two: e.g. `listing_stale_reminder`).
     - A single post-deadline nudge, not a countdown, since there's no deadline left to count
       down to — a "your listing turns 30 today" framing which is just inform­ational now, no
       urgency, matches Renew being purely optional.
   - New copy (`apps/bff/notification-templates/email/listing-expiry-reminder/*.txt`): **remove
     every claim about disappearing from search or freeing a slot** (both now false). Replace
     with something like: *"Your listing '{{title}}' has been live for 30 days. If it's no
     longer available, mark it as sold/rented so buyers stop reaching out. Still available? Tap
     Renew to refresh it."* — same "Manage my ads" button to `/my-listings`.
   - `getSellerAttention`'s `expiringWithinDaysCount` (`listings.service.ts:2101-2132`) — confirmed
     unused by any web/mobile UI today ("future seller banners," never built). Leaving it alone;
     not part of this plan's scope.

## Web changes (`apps/web/src`)

1. **`components/home/ListingDetailView.tsx`** — the critical fix. Lines ~204 and ~280: replace
   both `listing.isExpired` checks with `listing.status !== 'active'`. The "no longer accepting
   responses" block's copy should name what actually happened, not an age-based guess — e.g. reuse
   the existing `STATUS_LABELS` map (`my-listings/page.tsx`) to say *"This ad has been marked
   {label} and is no longer accepting responses."*
2. **`components/home/ListingMediaGallery.tsx`** — same swap: the `isExpired` badge (~line 92)
   becomes a `status !== 'active'` badge, showing the real status label instead of "Expired".
3. **`app/my-listings/page.tsx`**:
   - Active/Past split (`:131-132`, `activeListings`/`pastListings`) switches from `isExpired` to
     `status === 'active'` / `status !== 'active'` — "Past" now means *closed*, not *old*.
   - `canRenew` (`:238`) drops the `daysLeft <= RENEW_WINDOW_DAYS` gate entirely — becomes just
     `item.status === 'active'`, a true "optional, anytime" action per the user's call.
   - The "Expires in N days"/"Expired" line (`:278`) and the matching badge (`:253`) no longer
     reflect anything real — drop them; keep the existing "Renewed N times · last on …" history
     line as the only renewal-related info shown (already computed, no new plumbing needed).

## Mobile changes (`apps/mobile/src`) — exact same three fixes, confirmed to have the identical pattern

1. **`app/listing/[id].tsx`** (lines ~181, ~217, ~258-260) — identical `isExpired` →
   `status !== 'active'` fix for the badge, the countdown text, and — critically — the same
   action-blocking paragraph as web.
2. **`components/home/ListingMediaGallery.tsx`** (mobile, line ~78) — same badge fix.
3. **`app/my-listings/index.tsx`** — same `canRenew` (`:106`) and badge/text (`:121`, `:162-164`)
   adjustments as web's equivalent lines. This file already has a working Renew button (contrary
   to earlier assumption in this session that mobile had none) — keep it, just drop its countdown
   gate the same way web's does.

## Not doing

- Not touching `deleteExpiredAssistedListings`/`assisted-listing-expiry.job.ts` — unrelated
  lifecycle (unclaimed admin-assisted drafts), explicitly out of scope.
- Not removing the `expiresAt` column, the `ListingRenewal` audit table, or the Renew feature's
  mechanics — all kept, per "Renew stays as an optional action."
- Not changing `PropertyRequirement.expiresAt` (a separate, independently-timed field) — out of
  scope, not mentioned by the user.
- Not building anything new around `getSellerAttention`'s unused `expiringWithinDaysCount`.

## Verification

- BFF: extend `listings.service.spec.ts`'s existing expiry-related tests (if any cover `list()`
  filtering) to assert a `status: 'active'` listing with a past `expiresAt` still appears in
  `list()`/`getPopularSearches()`/`findAllForSitemap()`, and that `ListingSlotsService`'s active
  count includes it. Run the full bff jest suite after — expect the same 2 pre-existing, unrelated
  failures as baseline (confirmed earlier this session against clean `master`), nothing new.
- Manual: with a test listing whose `expiresAt` is set in the past but `status: 'active'` —
  confirm it still shows in browse/search, its detail page still shows full contact actions (not
  the "no longer accepting responses" block) on both web and mobile, and `my-listings` shows it
  under Active with a working, always-available Renew button. Then explicitly close it (set
  status to `sold`) and confirm it disappears from browse but its detail page URL still loads
  fully (soft delete confirmed) with "marked Sold" messaging instead of actions.
- `tsc --noEmit` on bff/web/mobile after the edits.
