# Preview page: Featured vs Normal comparison

## Status: implemented (2026-10-13)

## Goal

Make the Preview step explain what changes when an advertiser chooses Featured, while removing
duplicated price summaries and using the available page width more effectively.

## Existing behavior

The web Preview step rendered one `ListingPreviewCard`, whose `featured` prop followed the selected
boost plan, beside `BoostPlanSelector`. The selector listed each offered duration, then repeated
the selected boost price as **Feature add-on: ₹…** and showed a final **Due today: ₹…** summary.
A required platform fee, when applicable, was shown separately. The review panel was centered and
capped at 680px when the selector was present.

The mobile wizard has a corresponding Preview selector and should retain consistent price-summary
and comparison behavior where its layout supports it; this plan's requested left-aligned page
layout applies to the web Preview step.

## Implemented changes

1. **Remove duplicate end-of-selector price summaries.**
   - Remove the trailing **Feature add-on: ₹…** / “Not featuring this ad” summary and **Due today:
     ₹…** line from the Preview selector.
   - Keep prices on each selectable boost-duration option, the required platform-fee row, and
     existing payment/checkout behavior unchanged. The selector is a choice and price disclosure,
     not the payment confirmation.
2. **Use the Preview width and align the content to the left.**
   - Replace the narrow centered review wrapper with a wider, left-aligned review layout on desktop,
     retaining sensible page gutters and a mobile single-column layout.
   - Keep the listing-preview and boost-selection controls grouped together, with clear responsive
     ordering and no horizontal overflow.
3. **Show a clear Normal-vs-Featured comparison.**
   - Render the existing `ListingPreviewCard` in both states: **Normal ad** (`featured={false}`)
     and **Featured ad** (`featured={true}`).
   - Mark the state selected for publishing; retain the Normal baseline while showing the Featured
     badge, border, and other card treatment.
   - Stack at narrower breakpoints and use a side-by-side comparison on wide screens.
4. **Explain benefits with a fuller Featured bullet list.**
   - Show a clearly labeled **Featured gets you:** bullet list for the gold badge/card treatment,
     variable priority placement, possible Featured-rail exposure, Instant Alerts, and the daily
     activity digest on listings still Featured when the digest is sent.
   - Show an empirical effectiveness claim only when the existing sample-size gate supports it.
     Qualitative benefits otherwise; no guaranteed position or fixed uplift.
   - The duration options already show the total and daily equivalent, so don't repeat a price
     claim elsewhere. Explain value with the concrete Featured benefits and the existing,
     sample-size-gated Bhavano performance stat when available. Avoid subjective coffee-price
     comparisons or guaranteed returns.
   - Keep duration choices, discounts, savings, skip behavior, platform-fee rules, and checkout
     behavior intact.

## Implementation notes

- Web UI: `apps/web/src/components/home/PostAdWizard.tsx` owns the review layout, current live card,
  and boost selection state. `apps/web/src/components/home/ListingPreviewCard.tsx` is the reusable
  browse-card preview and already accepts the `featured` state.
- The existing web and mobile `BoostPlanSelector` components now surface Instant Alerts and the
  Featured-only daily digest as separate benefit bullets.
- The Preview selector opts out of repeated add-on/checkout totals. The selector retains those
  summaries by default on the publish-checkout recovery surface.
- The web Preview expands to use the available width, with the listing comparison beside the
  boost choices on wide screens and stacked content on smaller screens.
- Preserve the server-authoritative checkout total. This is a display-only Preview change; do not
  change publish pricing, payment creation, or what gets charged.
- Follow the actual featured-placement semantics in
  `docs/plans/featured-listings-visibility-improvements.md`; describe increased eligibility/visibility
  accurately rather than promising a guaranteed homepage slot.

## Acceptance criteria

- The Preview selector no longer ends with duplicate **Feature add-on** and **Due today** totals.
- Each available boost duration still shows its correct price and any existing discount/savings.
- A required platform fee remains clearly identified and priced when it applies.
- Normal and Featured versions of the same listing are visibly comparable; selecting a boost
  clearly emphasizes the matching Featured treatment.
- Featured benefits appear as multiple readable bullet points, distinguishable from the Normal
  ad's standard treatment, and never make a guaranteed-placement claim.
- Each duration option displays its total price and daily equivalent once; any performance claim
  remains behind the existing sample-size gate.
- Desktop content is left-aligned and uses more of the available width; mobile remains readable
  without document-level horizontal overflow.
- Skipping or selecting a boost preserves the existing selected state, recovery behavior, and
  checkout amount.

## Verification

- Existing effectiveness-message tests cover the sample-size and evidence-copy thresholds.
- Run the web typecheck, lint, and relevant web tests.
- Check the Preview layout at desktop and narrow mobile widths for document-level horizontal
  overflow and card legibility.

## Related plans

- `docs/plans/boost-instant-alerts-preview-selector.md`
- `docs/plans/boost-30-day-and-included-alerts.md`
- `docs/plans/boost-proof-stat-and-value-bands.md`
- `docs/plans/featured-listings-visibility-improvements.md`
