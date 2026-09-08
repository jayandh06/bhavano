# Contact-reveal credits + admin-managed discount codes

## Context

Buying a listing's owner's phone/email was impossible for a regular buyer — the only path to
reach an owner was the free in-app "Message" chat; `ListingOwnerDto` (phone/email) was admin-
only. A `ListingDetailActions.tsx`/mobile `[id].tsx` "View Contact" button was stubbed disabled
earlier in the same session that built this, explicitly to be wired up here.

This ships that: a buyer gets **2 free reveals, lifetime, across all listings** (admin-
configurable); after that, unlocking a listing's contact costs **1 credit**, credits are bought in
an **admin-configurable pack** (default 5 credits / ₹125) via the existing Razorpay flow,
**expire 6 months** after purchase, and once spent on a listing the reveal is **permanent** for
that user. Alongside this, admins get a **discount-code** system (coupon-style, not tied to a
referring user) that discounts any paid purchase in the app — credits, boosts, premium, agent
pro, seller slot packs — by a percentage, with per-code expiry/redemption caps.

Reuses existing, already-proven patterns rather than inventing new architecture: the `Payment` →
Razorpay-order → webhook → purpose-specific-entitlement-grant flow
(`apps/bff/src/payments/payments.service.ts`), `RateLimitSetting`'s singleton-row admin-settings
pattern, and `POST /conversations`'s auth-gated idempotent-get-or-create shape.

## What was built

### Data model (`apps/bff/prisma/schema.prisma`)

- `ContactRevealCreditBatch` — one row per purchased credit pack, a real balance ledger
  (`creditsGranted`/`creditsRemaining`/`expiresAt`) rather than a flat counter, so credits expire
  correctly: spending always draws from the batch with the earliest `expiresAt` first.
- `ContactReveal` — one row per (user, listing) reveal, `@@unique([listingId, userId])`, permanent
  once created. `contactRevealed` is always derived by querying this, never a cached flag.
- `ContactRevealSetting` — singleton admin-editable settings row.
- `DiscountCode` / `DiscountCodeRedemption` — admin-managed coupons; a redemption row is only
  created once a `Payment` reaches `paid` in the webhook, never at order-creation, so an abandoned
  checkout never consumes a redemption slot.
- `Payment` gained `creditPackSize`, `discountCodeId` (purpose-specific nullable fields, same
  convention as `boostDays`/`subscriptionMonths`).

### BFF

- `apps/bff/src/contact-reveal/contact-reveal.service.ts` — `getSettings`/`updateSettings`
  (find-or-create singleton), `getRevealState` (computes `contactRevealed`/`revealMethod` for the
  listing-detail response), `revealContact` (transactional spend, re-derives eligibility inside
  the transaction so two concurrent requests can't double-spend).
- `ListingsService.toDetailDto`/`findOne` — `ContactRevealState` threaded through as an optional
  parameter (same pattern as `favouritedIds`); only `findOne` computes a real one, every other
  `toDetailDto` call site (create/update/etc., returning a DTO to the listing's own owner)
  defaults to "not revealed," which the frontend never renders since `isOwner` already hides the
  reveal button.
- `POST /listings/:id/reveal-contact` — throws a 402 (`InsufficientContactRevealCreditsException`)
  when neither a free reveal nor a credit is available, which both frontends key off by HTTP
  status rather than message text.
- `PaymentsService` — `createContactRevealCreditsOrder`, a shared `resolveDiscountCode`/
  `applyDiscount` pair used by `createBoostOrder`/`createSubscriptionOrder` too (this is what
  makes discount codes apply across every paid product), and new webhook branches (grant the
  credit batch; create the `DiscountCodeRedemption` row for whichever purpose ran, since discounts
  apply everywhere).
- Admin: `GET/PATCH admin/contact-reveal-settings`, `GET/POST admin/discount-codes`, `PATCH
  admin/discount-codes/:id` — mirrors the `RateLimitSettingsDto` round-trip exactly.

### Admin UI

- `/settings/contact-reveal` — free-quota/pack-size/price/expiry form, copies
  `RateLimitSettingsForm.tsx`'s structure.
- `/discount-codes` — create form + table with a per-code activate/deactivate toggle.
- Both added to `AdminNav.tsx`.

### Web + mobile

- Both `ListingDetailActions.tsx` (web) and `app/listing/[id].tsx` (mobile) wired the
  previously-disabled "View Contact" button to the real endpoint; on success the button is
  replaced by the revealed phone/email inline.
- GTM `contact_reveal` event alongside the existing `contact_owner` one.

### Consent + privacy

- A short static line ("Your phone/email may be shown to users who unlock this listing's contact
  details") added to both `PostAdWizard`s' final review step.
- `apps/web/src/app/privacy/page.tsx`'s "What we share" section updated — it previously asserted
  contact details are visible "only once you message them," which is no longer true.

## Two deviations from the original plan, found during implementation

1. **Purchase UI on web uses `BoostButton.tsx`'s pattern, not a `HomeSheetsProvider` sheet.**
   The plan assumed the existing boost/premium purchase flow used the app's bottom-sheet system;
   it doesn't — `BoostButton.tsx` implements its own self-contained overlay modal that directly
   loads Razorpay's `checkout.js` and opens `window.Razorpay`. `ListingDetailActions.tsx`'s
   purchase dialog mirrors that real precedent instead.
2. **No native purchase flow on mobile.** There is no Razorpay integration anywhere in the mobile
   app today (no boost/premium purchase UI exists there at all) — adding one means a new native
   dependency requiring a fresh EAS build, a real scope jump beyond this feature. Mobile fully
   wires the free-quota/existing-credit-balance reveal path (a plain API call); when neither
   applies, it shows a message pointing the user at buying credits on the web app rather than
   improvising a native checkout.

## Verification (done)

1. `pnpm --filter @bhavano/types build`, `pnpm --filter bff typecheck`/`build`, `pnpm --filter
   web typecheck`/`build`, `pnpm --filter mobile typecheck`, `pnpm --filter admin
   typecheck`/`build` — all pass.
2. Migration applied cleanly against the local dev DB (the recurring `ListingPhoto.updatedAt`
   drift this session hit before was stripped out and the DB default restored manually, same as
   prior migrations this session).
3. `bff` test suite: 136/137 pass — the one failure is a pre-existing, unrelated stale assertion
   (confirmed via `git stash` before this work began).
4. Started the bff locally and confirmed every new route registers and is correctly
   `AuthGuard`-protected (`POST /listings/:id/reveal-contact`, `POST
   /payments/contact-reveal-credits`, the two admin settings/discount-codes route groups).
5. Simulated the actual reveal transaction end-to-end against the local dev DB: first reveal for
   a (user, listing) pair spends a free quota and creates the row; a second call for the same
   pair is correctly idempotent (returns the same contact, no duplicate row) — confirmed via the
   `@@unique([listingId, userId])` constraint.

## Not yet done

- No live Razorpay test-mode purchase has been run end-to-end (would need a funded test order and
  a way to trigger the real webhook) — the order-creation, discount application, and webhook
  credit-grant logic are code-reviewed and typecheck-verified, but not exercised with a real
  payment.
- No discount-code redemption-limit race-condition hardening beyond the transactional reveal
  spend — two near-simultaneous redemptions of a code at its last remaining slot could both pass
  the pre-webhook count check; low risk (a discount %, not free money) but worth knowing.
