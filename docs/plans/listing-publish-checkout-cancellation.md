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
- **Post without Featured** (new) — calls the action above via
  `cancelListingPublishCheckoutAction` (`apps/web/src/app/actions/payments.ts`), then moves straight
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
