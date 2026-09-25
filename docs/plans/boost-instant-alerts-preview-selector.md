# Boost/Instant Alerts plan selector on the ad Preview step

## Status: implemented (2026-09-22)

**Superseded in part (2026-09-25):** the wizard's "only ask for an account at Post ad" point below
is no longer true. Both web and mobile `PostAdWizard`s now ask for login when the user presses
**Preview Ad** (`onPreview()`), and continue straight to the Preview step on success. `onSubmit`
keeps its own login check as a fallback for a session that lapses between preview and publish.
Item 1's reasoning still stands for pricing: the selector still reads the public
`GET /plans/pricing`, which is fine — the login now happens before the Preview renders, not because
of what it calls.

Four things worth recording that diverged from — or weren't decided by — the plan below:

1. **Pricing source for the Preview-step selector had to change.** `PaymentsService.
   previewBoostPricing` (the personalized, discount/free-credit-aware endpoint the plan assumed
   the selector would call early) turned out to be `AuthGuard`-protected — calling it at the
   Preview step would force a login before the wizard's own deliberate "only ask for an account at
   Post ad" point. Fixed by having the selector (and the wizard's `showSelectorOnPreview` check)
   read the already-public `GET /plans/pricing` (via the existing `fetchPlanPricing`/
   `fetchBoostPricingAction`+`fetchInstantAlertsPricingAction`) instead, and computing undiscounted
   display prices client-side with a new shared helper, `buildDisplayBoostPricing()` in
   `packages/types/src/boostPricing.ts` — same "display-only estimate before a live fetch
   resolves" precedent `boostPriceFor` itself already established. The actual checkout (after
   "Post ad") still calls the real, authenticated, discount-aware order-creation endpoints, so
   what's charged is never affected by this — only what the Preview step displays beforehand.
2. **`showSelectorOnPreview` ended up on `BoostPricingPreviewDto` too**, not just the raw
   `BoostPriceSettings` — both `previewBoostPricing`'s authenticated response and the public
   settings row carry it now, so the post-creation `BoostBundleCard`/`BoostBundlePicker` (which
   already fetch the authenticated one for their own pricing) can self-gate off the same field
   without a second fetch.
3. **Web's auto-fire effect derives "in flight" instead of tracking it as separate state** —
   `boostCheckoutInFlight` is computed from `createdListing && selectedBoostPlan &&
   showSelectorOnPreview && boostCheckoutOutcome === null` rather than a `setBoostCheckoutPending`
   call inside the effect, to avoid a synchronous `setState`-in-effect (flagged by this repo's
   `react-hooks/set-state-in-effect` lint rule). Mobile kept an explicit `boostCheckoutPending`
   state instead, since that rule isn't active there (no lint script in `apps/mobile`).
4. **The migration was hand-authored**, not generated via `prisma migrate dev` — no local Postgres
   was reachable in the environment this was built in (Docker Desktop wasn't running). The SQL at
   `apps/bff/prisma/migrations/20260922060000_boost_price_show_selector_on_preview/migration.sql`
   is a single `ALTER TABLE ... ADD COLUMN ... DEFAULT false` and still needs `prisma migrate
   deploy` run against the real dev/prod databases before this ships — `prisma generate` alone
   (which was run) only regenerates the client's types, it does not touch the database.

## Context

Today, Boost and Instant Alerts are only ever offered to an advertiser *after* their ad is
already posted — a card/picker on the wizard's `success` step (`BoostBundleCard.tsx` on mobile
Android, `BoostBundlePicker.tsx` on web; iOS gets redirect-to-website buttons instead, see below).
The advertiser can't see or decide on boosting while they're still reviewing the ad itself.

The request: let the advertiser optionally pick a Boost/Instant Alerts plan **on the Preview
step**, next to the ad preview card, before they tap "Post ad" — still fully optional. Confirmed
scope with the user:
- **Both mobile and web** get this.
- **Mobile layout**: no existing side-panel pattern exists on phone width, so the selector renders
  as a section stacked directly below the preview card (not literally beside it).
- **Admin-configurable, mutually exclusive placement**: an admin toggle decides whether the
  selector shows on Preview *or* after ad creation (today's behavior) — never both at once.

### Why the money still moves after the listing exists (unavoidable, not a shortcut)

Boost/Instant Alerts activation is architecturally always a follow-up `Payment` row created
against an **existing** `listingId` (`createBoostOrder`/`createInstantAlertsOrder` in
`apps/bff/src/payments/payments.controller.ts` → `PaymentsService`), verified via
Razorpay webhook (`POST /payments/webhook`) before `activateListingBoost`/`activateInstantAlerts`
ever runs. There is no path anywhere in the codebase to create a listing pre-boosted in one shot,
and building one is out of scope for what's being asked. So "select on Preview, then click Post
ad" becomes: **capture the choice on Preview, create the listing exactly as today, then
immediately continue into the existing checkout flow using that pre-made choice** — instead of
making the user re-pick and tap again on the success screen. If checkout is cancelled or fails,
the listing stays posted but un-boosted — the same failure mode the current post-creation upsell
already has today, nothing new.

### The iOS constraint (must be preserved)

`PostAdWizard.tsx` (mobile) already documents *why* iOS never gets an in-app Razorpay checkout for
Boost/Instant Alerts (lines ~1058-1114): Apple Guideline 3.1.1 forbids processing a paid digital
feature's transaction in-app; iOS instead gets two buttons that redirect to the website to pay.
This plan must not violate that. On iOS, "continue into checkout automatically after posting"
means **opening the same website redirect URL** (`?openBoost=`/`?openInstantAlerts=` deep link)
that today's iOS buttons already open — that's just launching an external browser earlier, not new
in-app payment processing, so it stays compliant. Android and web get the real in-app/embedded
Razorpay checkout, same as today.

## Admin-configurable placement

Add one boolean to the existing `BoostPriceSetting` singleton row (`apps/bff/prisma/schema.prisma`)
rather than inventing a new generic feature-flag table — there's no such generic mechanism in this
codebase (checked), and every other admin-configurable knob here (`BoostPriceSetting`,
`InstantAlertsPriceSetting`, `SubscriptionPlanSetting`, `RateLimitSettings`,
`ContactRevealSettings`) is its own flat singleton-row model with a `*SettingsService`
(`getSettings`/`updateSettings`), an `AdminGuard`-protected controller route, and an admin form +
server action. This flag governs the same "how boost/instant-alerts is offered" concern
`BoostPriceSetting` already owns, and it's one field — a whole new model for a single boolean would
be premature.

```prisma
model BoostPriceSetting {
  // ...existing fields...
  showSelectorOnPreview Boolean @default(false)   // false = today's behavior (post-creation upsell)
}
```

- `apps/bff/src/plans/boost-pricing-settings.service.ts`: include the field in `getSettings`/
  `updateSettings`.
- `packages/types/src/boostPricing.ts`: add `showSelectorOnPreview: boolean` to
  `BoostPriceSettings` and its `DEFAULT_BOOST_PRICE_SETTINGS` (default `false`).
- `apps/bff/src/admin/dto/update-boost-pricing.dto.ts`: add optional `@IsBoolean() showSelectorOnPreview?: boolean`.
- **Expose it to clients via the existing `BoostPricingPreviewDto`**, not a separate settings
  fetch — `PaymentsService.previewBoostPricing` (backing `GET /payments/boost-pricing-preview`,
  already called by both `BoostBundleCard`/`BoostBundlePicker` today, and now to be called earlier
  by the Preview step) reads `BoostPriceSetting` anyway to price the four options; add
  `showSelectorOnPreview` as a fifth field on the same response. One fetch, both the pricing and
  the placement decision travel together, and every caller (new Preview selector, existing
  post-creation card/picker) can each independently decide "am I the one that should render right
  now?" from the same payload with no risk of the two disagreeing mid-session.
- `apps/admin/src/components/BoostPricingSettingsForm.tsx`: add one checkbox — "Show the
  Boost/Instant Alerts selector on the ad Preview step (instead of after posting)" — wired through
  the existing `updateBoostPricingAction` → `updateBoostPricingSettings` (`PATCH admin/boost-pricing`)
  plumbing, no new action needed.
- Prisma migration for the new column.

## Mutual exclusivity, mechanically

Because both the new Preview-step selector and the existing post-creation `BoostBundleCard`/
`BoostBundlePicker`/iOS-buttons-block each independently check the same `showSelectorOnPreview`
flag from the same `BoostPricingPreviewDto` fetch:
- `showSelectorOnPreview === true` → Preview-step selector renders; the post-creation block on the
  `success` step renders nothing (early-return `null`) instead of its current unconditional render.
- `showSelectorOnPreview === false` → Preview-step selector renders nothing; `success` step behaves
  exactly as it does today (fully unchanged code path).

## New selector component (per platform, no submit button)

A new component — `BoostPlanSelector.tsx` on both `apps/mobile/src/components/home/` and
`apps/web/src/components/home/` — reusing the exact visual language already established by
`BoostBundleCard.tsx`/`BoostBundlePicker.tsx` (two duration rows, "Add Instant Alerts" toggle,
price / "Free" / struck-through discount display via the same `optionKey` indexing into
`BoostPricingPreviewDto`), but with **no Pay/Activate button** — it only ever calls back
`onChange({ duration: 7 | 15, includeInstantAlerts: boolean } | null)` as the advertiser taps
around, `null` meaning "no plan selected" (the default — this stays optional).

Props: `{ pricing: BoostPricingPreviewDto; value: BoostPlanSelection | null; onChange: (v: BoostPlanSelection | null) => void }`.

**Default selection is pre-populated, not empty**: per the user's direction, the selector opens
with **15-day boost + Instant Alerts already checked** (`{ duration: 15, includeInstantAlerts:
true }`) rather than `null` — the advertiser sees a plan already chosen and priced, and has to
actively opt out. It must still stay genuinely optional: add an explicit "Skip / No boost"
affordance (a plain deselect action, not just tapping the already-selected 15-day row, since that
row being "selected" is now the pre-filled default rather than a toggle) that sets the value back
to `null`. This is a new requirement for this component specifically — `BoostBundleCard`/
`BoostBundlePicker` don't need an equivalent "skip" control today because their own "skip" is
simply never opening the post-creation card at all; the new pre-filled default on Preview makes an
explicit opt-out necessary here in a way it wasn't there.

## Wizard wiring — `PostAdWizard.tsx` (both `apps/mobile` and `apps/web`)

1. At the point the wizard reaches the `review`/`preview` step (both already have `category` known
   by then), fetch `previewBoostPricing(accessToken, category, ACTIVE_PROMO_CODE)` once — this is
   the same call `BoostBundleCard`/`BoostBundlePicker` already make, just now also reachable before
   the listing exists since it only needs `category`, never a `listingId`. Store in
   `boostPricing` state; add `selectedBoostPlan: BoostPlanSelection | null` state (new sibling
   `useState`, matching the wizard's existing granular-state idiom — no react-hook-form/context
   here), **initialized to `{ duration: 15, includeInstantAlerts: true }`** once `boostPricing`
   loads (not `null`) — see the selector's own "default selection" note above for why, and for the
   explicit skip path that clears it back to `null`.
2. If `boostPricing.showSelectorOnPreview`, render `<BoostPlanSelector>`:
   - **Web**: the review step is currently hard-capped to `max-w-[340px] mx-auto` around just the
     `ListingPreviewCard` (`apps/web/src/components/home/PostAdWizard.tsx:949`). Widen this step's
     container (e.g. to `max-w-[680px]`) and lay the card and the new selector out as a `flex
     flex-row gap-6` — preview card on the left, `BoostPlanSelector` on the right, matching "right
     side of ad preview" literally where there's room for it. Stack them (`flex-col`) below the
     existing `sm`/`md` breakpoint instead of forcing an unreadably narrow row.
   - **Mobile**: per the confirmed answer, render `BoostPlanSelector` as a plain sibling `View`
     directly below `ListingPreviewCard` in the existing single-column `ScrollView`
     (`apps/mobile/src/components/home/PostAdWizard.tsx`, review step ~1009-1042) — no new layout
     primitive needed, it's the same stacking every other step already uses.
3. **Extract the checkout-starting logic** out of `BoostBundleCard.tsx`/`BoostBundlePicker.tsx`
   into a small reusable function per platform (e.g. `startBoostCheckout(listingId, category,
   selection, accessToken)` in a shared lib file) — covers: resolve free-credit/`activated:true`
   short-circuit, else `createBoostOrder`/`createInstantAlertsOrder` → open Razorpay Checkout
   (web: `BoostBundlePicker`'s existing GTM `begin_checkout_boost`/`boost_purchase` events travel
   with the extraction, unchanged). Both the existing card/picker's own button and the new
   auto-continue path (next step) call this same function — no duplicated Razorpay wiring.
4. In `onSubmit` (the "Post ad" handler, both platforms), after `createListing` resolves with the
   new listing and `selectedBoostPlan` is non-null:
   - **Web / mobile Android**: call `startBoostCheckout(createdListing.id, category,
     selectedBoostPlan, accessToken)` right away (Razorpay opens on top of/just before the
     transition to the `success` step).
   - **Mobile iOS**: do *not* call `startBoostCheckout` — instead open the same
     `?openBoost=`/`?openInstantAlerts=` website redirect URL the existing iOS buttons use today
     (`Linking.openURL`), selecting which one based on `selectedBoostPlan`, preserving the
     Guideline 3.1.1-compliant path.
   - If `selectedBoostPlan` is `null` (advertiser skipped it), behavior is entirely unchanged —
     just post the ad.
5. **Failed/cancelled payment retry on the `success` step.** Suppressing the full post-creation
   upsell in "preview" placement mode (mutual-exclusivity section above) creates a real gap: if the
   auto-triggered checkout in step 4 fails or is cancelled, the advertiser would otherwise land on
   `success` with no visible way to retry — worse than today's behavior, where the card is simply
   still sitting there. Fix, scoped narrowly so it doesn't reintroduce the full picker:
   - **Web / mobile Android**: `startBoostCheckout`'s promise/callback reports outcome back to the
     wizard. Track a small local state, e.g. `boostCheckoutOutcome: "succeeded" | "failed" |
     "skipped" | null` (not persisted anywhere — this only needs to survive for the current wizard
     session, same lifetime as `createdListing` itself already has). If `"failed"` (cancelled by
     the user, card declined, dropped connection, anything short of the webhook's success), render
     one narrow line on `success` — "Payment for your {duration}-day Boost{ + Instant Alerts} didn't
     go through" plus a single "Finish boosting this listing" button that just calls
     `startBoostCheckout` again with the same `createdListing.id`/`selectedBoostPlan` (a fresh
     Razorpay order — retrying an order is already how re-tapping today's existing card recovers
     from a failed attempt, nothing new there). This is deliberately not the full
     `BoostBundleCard`/`BoostBundlePicker` — no duration/instant-alerts re-selection, just "try that
     same payment again."
   - **Mobile iOS**: no change needed beyond what already exists — the current iOS buttons
     (`apps/mobile/src/components/home/PostAdWizard.tsx:1058-1114`) already render unconditionally
     on `success` regardless of any prior attempt, since the app has no way to know whether a
     website-redirect payment succeeded. That existing "always show the button" design already
     doubles as the retry path here; just keep it visible in "preview" placement mode too (its
     `showSelectorOnPreview`-derived guard, if any is added per the mutual-exclusivity rule, should
     apply only to prices matching the full offer block, not to this always-on button pair — on
     reflection, iOS's buttons should stay exempt from the mutual-exclusivity suppression
     entirely, since they were never a duplicate "offer" so much as a durable "pay here" link).
   - **Known limitation, accepted as out of scope**: if the advertiser fully closes the app mid
     Razorpay-checkout (not just cancels within it) and reopens later, this in-session
     `boostCheckoutOutcome` state is gone and no retry prompt appears — recovering from that would
     need a server-side "pending payments for this listing" query this plan doesn't build. Boosting
     an already-posted listing later through whatever path exists outside the wizard (unchanged by
     this plan) remains available regardless.

## Files touched (representative, not exhaustive per platform)

- `apps/bff/prisma/schema.prisma` + migration — `BoostPriceSetting.showSelectorOnPreview`.
- `apps/bff/src/plans/boost-pricing-settings.service.ts`, `apps/bff/src/payments/payments.service.ts`
  (add the field to `previewBoostPricing`'s response).
- `apps/bff/src/admin/dto/update-boost-pricing.dto.ts`.
- `packages/types/src/boostPricing.ts`, `packages/types/src/index.ts` (`BoostPricingPreviewDto`
  gains `showSelectorOnPreview`; new `BoostPlanSelection` type).
- `apps/admin/src/components/BoostPricingSettingsForm.tsx`.
- `apps/mobile/src/components/home/BoostPlanSelector.tsx` (new), `BoostBundleCard.tsx` (extract
  checkout fn + guard on `showSelectorOnPreview`), `PostAdWizard.tsx`, a new shared
  `startBoostCheckout` lib function.
- `apps/web/src/components/home/BoostPlanSelector.tsx` (new), `BoostBundlePicker.tsx` (same
  extraction + guard), `PostAdWizard.tsx`, its own `startBoostCheckout`.

## Verification

1. `pnpm --filter bff typecheck`/`lint`/`test` after the schema + DTO + service changes; extend
   `boost-pricing-settings` tests (if a spec file exists) with the new field's default/round-trip.
2. `pnpm --filter admin typecheck`/`lint`/`test`/`build` after the settings-form checkbox.
3. `pnpm --filter mobile`/`pnpm --filter web` typecheck/lint.
4. Manual, both placements, both platforms:
   - Toggle admin setting to "preview" → confirm selector appears on Preview (web: right side of
     card on desktop width, stacked on narrow; mobile: stacked below card), confirm the
     post-creation card/picker no longer appears on `success`.
   - Confirm the selector opens pre-filled with 15-day boost + Instant Alerts checked, and priced
     accordingly, without the advertiser tapping anything.
   - Leave the default as-is, tap Post ad → confirm listing posts, then (web/Android) Razorpay
     checkout opens for 15-day boost + Instant Alerts, or (iOS) the website redirect opens instead
     — never an in-app Razorpay sheet on iOS.
   - Change the selection (e.g. switch to 7-day, or untoggle Instant Alerts) → confirm checkout
     reflects the changed combo, not the original default.
   - Explicitly skip (use the new "Skip / No boost" affordance) → posting behaves exactly as today,
     no checkout triggered.
   - Toggle admin setting back to "after creating the ad" → confirm Preview selector disappears
     and the original post-creation upsell reappears, on both platforms.
   - Cancel/fail checkout mid-flow (web and Android) → confirm the listing remains posted but
     un-boosted, and that the new narrow "Finish boosting this listing" retry prompt appears on
     `success` (not the full picker) — tapping it retries payment for the same pre-made selection.
     Confirm the retry button disappears once a retry actually succeeds.
   - iOS: confirm the existing redirect buttons still appear unconditionally on `success` even in
     "preview" placement mode, regardless of whether the earlier website redirect was completed.
