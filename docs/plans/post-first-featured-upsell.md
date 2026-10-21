# Post first (free), offer Featured on the confirmation screen

## Status: success-screen change implemented (2026-10-20); the admin flag flip is a separate, deliberate step

## Problem

The Review step pre-selects a 15-day Featured boost (`showSelectorOnPreview` on). Free posting is
behind a small "Skip" link. Observed outcomes: some sellers hesitate and never post, some find the
free path, some press "Post ad" without realising it starts a payment, close Razorpay and end up
with an ad that is not live (`pending_checkout`), and some pay. See
[`listing-publish-checkout-cancellation.md`](listing-publish-checkout-cancellation.md).

## Decision

Post first, upsell second:

1. Review step shows the normal ad preview; "Post ad" always publishes live, free.
2. The success screen shows the same ad **as Featured** ("Your ad with Featured"), the existing
   `BoostBundlePicker` / `BoostBundleCard` (prices, promo, sample-size-gated proof line), and a
   visible **Maybe later** link.

Rationale and data: [`boost-offer-conversion-2026-09.md`](boost-offer-conversion-2026-09.md) —
18 of 19 paid boosts began within 10 minutes of posting, and the success-screen placement
converted 4.4% of posted ads.

## What changed

- Web `PostAdWizard.tsx` and mobile `PostAdWizard.tsx`: in the flag-off branch of the success step,
  a `ListingPreviewCard featured` (built from the wizard's form state, with the created listing's
  category/transaction type) sits above the picker; "Maybe later" hides the offer for that wizard
  mount (`boostOfferDismissed`, not persisted).
- Web layout (2026-10-20): the Preview step is centered (`mx-auto`). The confirmation screen keeps
  "Your ad is live!" centered at the top, then a two-column row (live-ad preview on the left, Featured
  picker + "Maybe later" on the right; stacks on narrow screens), then the share card and the rest
  centered below.
- Mobile layout (2026-10-20): the Review preview is centered (max width 360). On the confirmation
  screen the header stays centered; on phones the live-ad preview sits above the Featured card, and
  from 700px wide (tablets) they sit side by side, preview left / picker right. iOS now shows the same preview + Maybe later above its
  App Store boost card (the price in that sheet is still Apple's, never the admin plan's).
- **Audience wording (2026-10-20):** the confirmation message ("It's now visible to … searching your area") and the boost card heading ("Reach more …, faster") name who the ad is for instead of always saying "buyers": buyers (sale), tenants (rent/lease), people looking for a PG, teams and freelancers (coworking), people looking for storage, customers (interiors). One helper, `audienceFor(category, transactionType)` in `packages/types/src/audience.ts`, shared by web and mobile (tested in `apps/web/src/lib/audience.test.ts`). Still saying "buyers" and not yet changed: the "not visible to buyers until payment" lines on My listings / edit / checkout recovery, the edit-page status label, and the recovery-dialog stat headline (site-wide numbers).
- **Dedicated offer screen (2026-10-20).** After **Post ad** the ad is created and live, free, and the wizard goes to a new `offer` step before the confirmation: "✓ Your ad is posted — Show your ad to more {audience}?", the Featured preview card, the existing picker (web `BoostBundlePicker`, Android `BoostBundleCard`, iOS App Store sheet at Apple's prices) and a one-tap **No thanks, continue**. Paying or skipping continues to the "Your ad is live!" confirmation; the confirmation keeps a small **Make it Featured →** link that reopens the offer (hidden once Featured). The offer no longer sits on the confirmation screen. It appears only when the Preview-step selector is off (iOS always uses it, since its offer is the App Store sheet). Why: the offer gets the whole screen instead of sitting under a headline that reads as "done", it reaches everyone who posts, and it is a measurable step. Tracking: web `post_step_view` with `step: "offer"` and a `/post/offer` synthetic page view (admin trail label "Featured offer", funnel row "Featured offer screen" after Success); `post_offer_skipped` GTM event on "No thanks". The funnel row counts sessions shown the offer; paying is read from the existing `listing_boost` payments. Recovery paths (retry publish checkout, post-without-Featured) still go straight to the confirmation.
- **Offer screen content (2026-10-20):** shows the ad twice, **Your ad today** (normal card) beside **Your ad with Featured** (gold card), then a **Featured gets you:** list, the price picker, and **No thanks, continue**. The list is one shared constant, `FEATURED_BENEFITS` (`packages/types/src/featuredBenefits.ts`): gold badge and card styling; priority placement above regular ads (position not guaranteed); may appear in the home-page Featured section; the card cycles through photos; instant email/WhatsApp message alerts; up to 12 photos and 5 videos of up to 3 minutes (taken from `PHOTO_LIMITS`/`VIDEO_LIMITS`). The web picker takes `hideBenefits` on this screen so its own two bullets do not repeat the list; the iOS card drops its four inline bullets for the same reason. The cards stack on phones and sit side by side from md (web) / 700px (mobile).
- **Wording and cancel (2026-10-21):** the Review button is worded for the audience, via `reachLabelFor` in `packages/types/src/audience.ts`: "Reach more tenants" / "buyers" / "PG seekers" / "teams" / "customers", "Reach more people" when unknown (was "Post ad"; it still publishes the ad live and free). The offer screen no longer opens with "✓ Your ad is posted", only "Show your ad to more {audience}?". Closing the payment window without paying (web `BoostBundlePicker` / mobile `BoostBundleCard`, new `onCancelled`) goes straight to "Your ad is live!", same as "No thanks, continue" (web fires `post_offer_skipped` with `via: "payment_cancelled"`). Error texts that said "tap Post ad" say "try again". The assisted-mode button stays "Save for seller".
- **Click tracking in Page visits (2026-10-21):** every click on the Featured offer and "Your ad is live!" screens is written as a synthetic page visit `/post/action?screen=<offer|live>&event=<name>[&days=<n>]` (`apps/web/src/lib/postActionTrail.ts`), decoded into a sentence by the admin `trailEntry()` ("Featured offer — tapped Pay (15 days)"). Offer: `plan_selected`, `pay_tapped`, `paid`, `activated`, `free_boost_used`, `cancelled`, `error`, `skipped`. Live: `share_whatsapp`, `share_facebook`, `share_poster`, `make_featured`, `view_ad`, `feedback`. Deliberately not under `/post/offer` or `/post/success`, because the admin funnel counts sessions by path prefix and a click must not read as another arrival at a step. Web only; the mobile app does not write these yet. The Get-app card keeps its own `/get-app` events.
- No pricing, payment, BFF or flag behaviour changed.

## Not changed / open

- `showSelectorOnPreview` is still whatever admin has set. Turning it **off** (Admin → Boost pricing)
  is what activates this flow; with it off, `boostIntent` is null, no hidden default is charged, the
  post-success auto-checkout effect is inert, and the picker is shown. It is a global switch, so
  evaluate before/after (boost rate, live-ad share, revenue per posted ad), not an A/B test.
- iOS app still cannot pay in-app (Apple 3.1.1); it keeps its existing redirect path.
- Still to build (from the earlier recommendations): the per-user 48-hour offer clock, the
  ~24h low-views nudge and the first-enquiry nudge.
- Mobile was not typechecked: `tsc` in `apps/mobile` crashes with a stack overflow on a clean tree
  too (pre-existing).
