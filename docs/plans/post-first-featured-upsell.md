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
