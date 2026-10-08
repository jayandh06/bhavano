# Listing-publish checkout cancellation

## Problem

The Review step pre-selects the 15-day Featured boost by default. Clicking "Post ad" creates the
listing (as `pending_checkout` whenever a platform fee applies or a boost was requested) and opens
Razorpay. If the advertiser backs out of that checkout:

- The `Payment` row this created (`purpose: listing_publish`, `status: created`) never resolves —
  nothing marks it `failed`, so it sits at `created` forever. This is pure data-hygiene noise in
  the `created`-status backlog, unrelated to whether the ad itself ever goes live.
- The admin setting `PlatformFeeSettings.allowLivePublishWithPendingPayment`, when **on**, makes
  `pendingCheckout` always `false` at creation time (`ListingsService.create`), so the ad posts
  `live` immediately regardless of whether Razorpay ever resolves. This isn't a bypass hack — the
  listing go-live and the Razorpay checkout genuinely run in parallel, and `boostActive` is only
  ever set by a real payment, so nobody gets Featured placement for free. But the advertiser does
  see "Ad is live" **before** the payment decision is made, which trains the (accurate!) perception
  that backing out of the Featured payment has no real consequence.
- Turning that flag **off** (so the live confirmation genuinely waits on payment) used to be a dead
  end: the Review step's only recovery for a cancelled checkout was "Retry payment" — there was no
  way to say "fine, just post it without Featured." That's why turning the flag off previously
  caused real abandonment instead of fixing the perception problem — mandating payment with no
  escape hatch just converts "silent free pass" into "stuck, so they leave."

## Design

Rather than restructuring to "don't create the listing until payment resolves" (which would need a
new place to persist the full draft payload — photos, attributes, etc. — before a `Listing` row
exists), the fix reuses what's already there:

- `Payment.listingId` is nullable, and listing deletion already nulls it out
  (`ListingsService.deleteCompletely`) rather than requiring every payment to point at a real row.
- The listing id is generated **client-side** (`crypto.randomUUID()`) before anything is uploaded,
  so nothing about creation timing needs to change.
- `ListingsService.completePendingPublish(listingId)` already exists and already does exactly
  "publish this `pending_checkout` listing live, no boost" — it's what `createListingPublishOrder`'s
  own `amountInPaise === 0` branch calls today when nothing is owed.

So the fix is a new, owner-scoped, explicit action — not a flag, not an automatic fallback — that
the advertiser has to click:

**`PaymentsService.cancelListingPublishCheckout(userId, listingId)`**
(`apps/bff/src/payments/payments.service.ts`)
1. Loads the listing, requires `ownerId === userId` and `publishState === 'pending_checkout'`.
2. Marks the matching `Payment` row(s) (`purpose: listing_publish`, `status: created`) as `failed`
   — closes out the abandoned order instead of leaving it dangling.
3. Calls `completePendingPublish(listingId)` — publishes the ad live, no boost, same outcome as if
   Featured had never been selected.

Exposed as `POST /payments/listing-publish-order/:listingId/cancel`
(`apps/bff/src/payments/payments.controller.ts`), owner-authenticated via `AuthGuard`.

On the web side (`apps/web/src/components/home/PostAdWizard.tsx`), the Review step's cancelled-
checkout banner now shows **two** buttons instead of one:
- **Retry payment** (existing) — re-opens Razorpay against the same `pending_checkout` listing.
- **Post without Featured** (new) — opens the same `BoostRecoveryDialog` used by the Skip link
  (see docs/plans/boost-recovery-dialog.md's 2026-10-08 update), rather than acting immediately.
  "Add Feature" there retries the payment already in flight; "No thanks" calls
  `cancelListingPublishCheckoutAction` (`apps/web/src/app/actions/payments.ts`) and moves straight
  to the success step with the now-live listing.

## What this does and doesn't change

- Does **not** touch `allowLivePublishWithPendingPayment` — that flag is unchanged by this work.
- Makes it safe to eventually turn that flag off: once "Post without Featured" exists, mandating
  payment no longer creates a dead end, so cancelling the checkout stops looking like a free pass —
  the advertiser is offered a real choice (pay, retry, or explicitly post for free) instead of an
  accidental one. Flipping the flag is a separate, deliberate follow-up, not part of this change.
- Does **not** touch the Featured pre-selection or the "Skip" link's friction — that's a separate,
  business-sensitive growth/conversion question, independent of the payment-integrity fix here.
- Does **not** retroactively clean up `Payment` rows already stuck at `created` from before this
  shipped — that's a one-off backfill, not yet scheduled.

## Status

Implemented (BFF method + endpoint, web action + UI). Not yet deployed. The admin flag flip and the
historical-backfill cleanup are both intentionally left as separate, later decisions.

## Same gap, different purpose: `listing_boost` orders (fixed 2026-10-08)

With the flag **on**, the listing posts `live` at creation time regardless of Featured — so the
Razorpay checkout the advertiser sees afterward on the Review/success step isn't the listing-publish
one this doc describes at all, it's `PaymentsService.createBoostOrder`'s add-on purchase
(`purpose: listing_boost`). That path never had the cleanup step 2 above describes: every retry
(`retryBoostCheckout` in `PostAdWizard.tsx`) called `createBoostOrder` again, and each call
unconditionally inserted a new `Payment` row with no check for an existing unresolved one. Two
cancelled attempts therefore left two `created` rows, both permanently stuck (the webhook only ever
resolves a row by its own `razorpayOrderId`, so an abandoned order has nothing that marks it
`failed`) and both showing as "Pending" on admin's Subscriptions page (`apps/admin/src/app/subscriptions/page.tsx`,
which lists every `Payment` row by purpose, not just `UserSubscription`).

Fixed by giving `createBoostOrder` the same opening step `cancelListingPublishCheckout` already had:
before creating a new order, mark any of this listing's existing `created`/`listing_boost` rows
`failed` (`apps/bff/src/payments/payments.service.ts`, right after the ownership check). A retry now
always fails the previous attempt first, so at most one `listing_boost` row per listing is ever
"Pending" at a time. Same historical-backfill caveat as above: rows already stuck from before this
shipped aren't retroactively cleaned up.

## "Post without Featured" reopened Razorpay anyway (fixed 2026-10-08)

Reported live: tapping "Post without Featured" → "No thanks, post without featuring" in the
recovery dialog (the `cancelledTriggered` branch of `handleBoostRecoverySkip`) correctly cancelled
the checkout and posted the ad live — but then immediately opened a **second**, unrelated Razorpay
checkout, for the Feature the advertiser had just declined.

Cause: that branch calls `handlePostWithoutFeatured`, which updates `createdListing` to the
now-`live` listing, but — unlike the sibling `skipTriggered` branch right below it — never cleared
`selectedBoostPlan`. The legacy post-success boost-checkout auto-fire effect
(`PostAdWizard.tsx`, keyed on `createdListing`/`category`/`selectedBoostPlan`) only refuses to fire
while `publishState === "pending_checkout"`; the moment `createdListing` flipped to `"live"` with a
boost plan still selected, that guard opened and the effect fired a fresh boost purchase on its own.

Fixed by clearing `selectedBoostPlan` to `null` in the `cancelledTriggered` branch before posting
without Featured, matching what `skipTriggered` already did. Web only — mobile never got the
"Post without Featured after cancelling checkout" recovery path this bug lived in, so it was never
exposed to this.

## Tapping "Post ad" again after a cancelled checkout crashed with a 500 (fixed 2026-10-08)

Caught live in a real Google Ads session (admin Page visits, 2026-10-08 ~9:15pm IST): cancelled the
publish checkout twice, then — instead of "Retry payment" or "Post without Featured" — tapped
**"Post ad"** again (it's always visible in the Review step's footer, independent of the
cancelled-checkout banner above it). That re-ran the whole upload+create flow and crashed twice in
a row with a bare `"Internal server error"`; the advertiser gave up with no ad ever live.

Cause: `PostAdWizard`'s `listingId` is one `crypto.randomUUID()` generated at mount and reused on
every submit attempt for the same draft (web and mobile both). `ListingsService.create()` did a
plain `prisma.listing.create({ data: { id: input.id, ... } })` with no check for an existing row —
a retry's INSERT collides on the primary key, Prisma throws an unhandled
`PrismaClientKnownRequestError` (P2002), and `AllExceptionsFilter` has no special case for it, so it
falls through to Nest's default 500 response.

Fixed in `ListingsService.create()`: right after the deleted-account check, look up `input.id`; if a
listing with that id already exists and belongs to the same owner, return it as-is (`toDetailDto`)
instead of attempting the insert — the retry is the same draft, not a new one, so handing back what
already exists is correct regardless of which attempt "won". Skips slot-cap/moderation/etc. on that
path since nothing is actually being created. No existing test coverage for `create()` to extend
(it has none today); verify manually after deploy by cancelling a publish checkout and tapping
"Post ad" again.
