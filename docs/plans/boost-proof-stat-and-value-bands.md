# Boost: show the real proof stat, then price by listing value within each segment

## Status: Phase 1 + Phase 2 both done (2026-10-06)

**Phase 2 landed with one deliberate deviation from the plan below, for safety:** rather than
replacing `BoostPriceSettings`'s flat fields with `rules` (as originally sketched), the flat
fields were kept untouched and a new, purely additive `valueBandRules?: BoostPricingRule[]`
field was added alongside them — because this session had no way to test a real migration
against the live production DB (the host is only reachable from inside Bhavano's own
infrastructure). An existing settings row with no bands configured yet behaves identically to
today, by construction, with zero migration risk — the "ship as a no-op first" rollout step the
plan called for happens automatically rather than needing a separate deploy.

Everything else landed as planned: `boostPriceFor` takes an optional `{transactionType, value}`
context and checks `valueBandRules` first, falling back to the flat tier price when no rule
matches or no context is given; `DEFAULT_VALUE_BAND_RULES` seeds the 6 placeholder rules from the
table below; `createBoostOrder`/`createListingPublishOrder`/`previewBoostPricing` all pass the
listing's real `transactionType`/`price`; `BoostBundlePicker`/`BoostBundleCard`'s preview calls
now carry `listingId`; the ad-preview step's `buildDisplayBoostPricing` calls (web + mobile
`PostAdWizard`) pass the in-progress wizard's own price/transactionType once the seller has
actually entered a number; a new admin UI section ("Price bands by listing value") edits the 6
rules' cutoffs and per-duration prices. Migration written by hand
(`20261006210000_boost_price_value_bands`, additive `ALTER TABLE ... ADD COLUMN`) since this
session has no DB access to generate one from a real diff — review it before applying.

**One call site deliberately left without the new context**:
`PublishCheckoutRecovery.tsx` (web) only has a `ListingDetailDto` with pre-formatted display
price strings ("₹60,00,000"), no raw number — parsing that back into a number was judged not
worth the fragility for this one secondary surface (the publish-checkout recovery modal, a
narrower edge case than the main success-screen card or the ad-preview step). It safely falls
back to flat-tier pricing, unchanged from before this plan.

`tsc --noEmit` clean across bff/web/mobile/admin; bff 799/801 and mobile 67/67 passing (the 2 bff
failures are the same pre-existing, unrelated failures confirmed against a clean `master`
earlier this session). New unit tests added for the band-matching logic itself
(`apps/bff/src/payments/boost-pricing.spec.ts`).

## Context

Two separate questions, combined into one implementation because they touch the same screens:

1. **Why do so many sellers skip Boost?** (`docs/plans/boost-offer-conversion-2026-09.md`):
   435 listings posted → only 34 ever started checkout (7.8%) → 19 paid (4.4%). The single
   strongest argument — boosted listings get ~12x the views in week one (18.9 vs 1.6) — isn't
   shown anywhere on the main post-success Boost card today; it only exists in a narrower,
   web-only recovery dialog.
2. **Should Boost/platform-fee pricing vary by more than category?** (this session's
   `docs/plans/segmented-ad-pricing-analysis.md`): today pricing is category-tier-only (3
   buckets). The one idea with no existing data or decision against it — price bands by the
   listing's own value — is worth building. Sell-vs-rent, agent-vs-owner, and PG/coworking were
   each checked against existing docs/data and explicitly are **not** part of this plan (agent
   pricing in particular has a standing, evidence-based "not recommended" in
   `docs/plans/broker-paid-bundles.md` — confirmed with the user to leave deferred).

**User's refinement on bands, mid-planning:** a sale price (₹80L) and a monthly rent (₹15k) are
different scales, so bands must be computed per segment using the right value signal, not one
shared "price" number:
- Property tier, **sell** transactions → bands by sale price.
- Property tier, **rent/lease** transactions → bands by monthly rent (separate cutoffs from sell).
- **Furniture** → sold *and* rented in this app (`ads_retarget_owners.py`'s "Rent out Furniture"
  ad group confirms rental furniture is real usage) → needs its own sell-band set *and*
  rent-band set.
- **PG** → inherently monthly → bands by monthly rent, own cutoffs (distinct from generic
  property rent).
- **Coworking** → inherently monthly → bands by monthly seat/desk price, own cutoffs.
- Storage stays flat (not asked about, no reason to change it).
- Agent bundle (broker-paid-bundles.md Phase 2) stays deferred — **not** built here.

All new band price numbers below are **explicit placeholders**, same convention this codebase
already uses (`broker-paid-bundles.md` Phase 2: "numbers below are placeholders to be set from
Phase 1 data") — production DB wasn't reachable from this session to pull real percentiles.
Confirmed with user: ship with placeholders, tune from real data later via the admin settings
this plan adds.

## Phase 1 — show the real proof stat on the main Boost card (ship first, independent, low risk)

**Status: done (2026-10-06).** `BoostBundlePicker.tsx` (web) and `BoostBundleCard.tsx` (mobile)
both take a new optional `effectiveness` prop, rendered via the existing
`boostRecoveryMessage(effectiveness)` pure function — no new BFF work, exactly as scoped. Mobile
needed one extra fix along the way: `fetchPlanPricing()` in `bffClient.ts` already called
`GET /plans/pricing` (which already returns `boostEffectiveness`), but its TS return type was
missing that field, so it was silently inaccessible — added it there and to
`PostAdWizard.tsx`'s `planPricingSettings` state type. `BoostProvider.tsx` (web, My Listings) and
`BoostOfferMessageCard.tsx` (mobile, admin message) both still use these components without the
new prop — deliberately left as-is per the plan's scope (the main post-success card is where the
data says the decision actually happens: 18/19 paid boosts within 10 minutes of posting); the
prop being optional means they still get the honest generic fallback line, not nothing. `tsc
--noEmit` clean on both apps; mobile's full Jest suite 67/67 passing (web has no jest suite at
all — confirmed, not a gap introduced here).

The data already exists and is already used elsewhere — this is pure UI threading, no backend
work.

- **Reuse, don't rebuild**: `BoostEffectivenessDto` (`packages/types/src/boostEffectiveness.ts`),
  served by `GET /plans/pricing`'s `boostEffectiveness` field (computed nightly by
  `apps/bff/src/plans/boost-effectiveness.job.ts`, min sample size 10, gated fallback copy already
  built into the pure function `boostRecoveryMessage(effectiveness)`).
- **Web** (`apps/web/src/components/home/BoostBundlePicker.tsx`): add an `effectiveness?:
  BoostEffectivenessDto | null` prop. Its parent (`PostAdWizard.tsx`) already fetches
  `planPricingSettings` for the existing `BoostRecoveryDialog` (line ~2122,
  `planPricingSettings?.boostEffectiveness`) — pass the same value down to `BoostBundlePicker`
  wherever it's rendered on the success screen. Render `boostRecoveryMessage(effectiveness)`
  between the benefits `<ul>` (lines 210-222) and `freeBoostBlock` (line 224).
- **Mobile** (`apps/mobile/src/components/home/BoostBundleCard.tsx`): same new prop. Unlike web,
  mobile's `PostAdWizard.tsx` doesn't currently fetch `boostEffectiveness` at all (no recovery
  dialog exists there yet) — add a fetch of the existing `GET /plans/pricing`-equivalent
  (mirror whatever `bffClient.ts` already exposes for plan pricing, or add the one missing call
  following the same shape as `previewBoostPricing`). Render between the header block
  (lines 147-157) and `{freeBoost}` (line 159).
- No DTO/endpoint changes — the data already exists and is already shaped correctly.

## Phase 2 — price bands by listing value

### Data model — a structured rule list, not more flat fields

`BoostPriceSettings` today is 9 flat named price fields (one per tier × duration) plus flags.
Band pricing across 5 segments (property-sell, property-rent, furniture-sell, furniture-rent, PG,
coworking) × up to 3 bands × 3 durations would be 40+ flat fields — unmaintainable and painful to
admin-edit. Restructure to:

```ts
interface BoostPriceBand {
  maxValue: number | null; // the band's upper cutoff (sale price or monthly rent, depending on
                            // the rule); null = top band, no upper bound
  price7d: number;
  price15d: number;
  price30d: number;
}

interface BoostPricingRule {
  categories: ListingCategory[];      // e.g. ["house","apartment","villa","plot","commercial"]
  transactionTypes: TransactionType[]; // e.g. ["sell","buy"] vs ["rent","lease"]
  bands: BoostPriceBand[];             // sorted ascending by maxValue, last entry maxValue: null
}

interface BoostPriceSettings {
  rules: BoostPricingRule[];
  showSelectorOnPreview: boolean;
  boost7dEnabled: boolean;
  boost15dEnabled: boolean;
  boost30dEnabled: boolean;
  allowSkippingBoost: boolean;
}
```

Storage keeps a single-band rule (one entry in `bands`, `maxValue: null`) — same shape, no special
case needed.

### Placeholder bands to seed `DEFAULT_BOOST_PRICE_SETTINGS` with

| Rule | Band 1 | Band 2 | Band 3 |
|---|---|---|---|
| Property, sell/buy (by sale price) | <₹50L: ₹149/249/449 | ₹50L–2Cr: ₹199/349/599 (today's flat price) | >₹2Cr: ₹349/599/999 |
| Property, rent/lease (by monthly rent) | <₹15k/mo: ₹99/179/299 | ₹15k–50k/mo: ₹199/349/599 | >₹50k/mo: ₹299/499/849 |
| Furniture, sell (by sale price) | <₹5k: ₹29/49/79 | ₹5k–20k: ₹49/89/149 (today's flat price) | >₹20k: ₹79/139/229 |
| Furniture, rent (by monthly rent) | <₹500/mo: ₹19/29/49 | ₹500–2k/mo: ₹29/49/79 | >₹2k/mo: ₹49/79/129 |
| PG (by monthly rent) | <₹6k/mo: ₹49/89/149 | ₹6k–15k/mo: ₹99/179/299 (today's flat price) | >₹15k/mo: ₹149/259/429 |
| Coworking (by monthly seat price) | <₹3k/mo: ₹49/89/149 | ₹3k–10k/mo: ₹99/179/299 (today's flat price) | >₹10k/mo: ₹149/259/429 |
| Storage | single band, unchanged: ₹99/179/299 | — | — |

Each table's *middle* band is set to today's existing flat price, so nobody's typical listing
gets a price shock on rollout — only genuinely cheap or genuinely expensive listings move.

### Code changes

- `packages/types/src/boostPricing.ts`: replace the category-only bucketing with rule matching —
  `boostPriceFor(category, transactionType, days, value, settings)` finds the matching rule
  (by category + transactionType) and the matching band (by `value <= band.maxValue`, or the last
  band if none matches), falls back to the old category-only tier behavior if `value` is
  `undefined` (keeps every existing call site compiling without immediately needing the new
  param, for a staged rollout).
- `apps/bff/src/payments/payments.service.ts` — the two real charge paths already have the full
  `listing` row in scope, so this is a one-line change each:
  - `createBoostOrder` (listing fetched line 379, call site line 469): pass
    `listing.transactionType`, and the right value signal (`listing.price` for sell/buy,
    whatever field holds monthly rent for rent/lease — confirm exact field name, likely still
    `listing.price` since rent listings store the monthly figure there too per schema).
  - `createListingPublishOrder` (listing fetched line 624, call site line 638): same.
  - `previewBoostPricing` (line 517) — this is the one that needs new plumbing: it currently
    takes `category` only, no `listingId`. Add `listingId` to `PreviewBoostPricingDto`
    (`apps/bff/src/payments/dto/preview-boost-pricing.dto.ts`), fetch the listing inside
    `previewBoostPricing` to read `transactionType`/price, and thread `listingId` through from
    both callers — web's `previewBoostPricingAction(category)` and mobile's
    `previewBoostPricing(accessToken, category, ...)` in `bffClient.ts` — both components
    (`BoostBundlePicker`/`BoostBundleCard`) already receive `listingId` as a prop today, so this
    is passing something they already have, not new data plumbing on the client side.
- `apps/bff/src/plans/boost-pricing-settings.service.ts` — stays a thin passthrough CRUD service;
  only the shape of what it reads/writes changes (Prisma column likely needs to move from
  discrete columns to a JSON column holding `rules`, given the nested array shape — check the
  current `boostPriceSetting` table schema and migrate accordingly).
- **Admin UI**: extend whatever currently edits the 9 flat prices into a per-rule band editor —
  one section per rule (Property-Sell, Property-Rent, Furniture-Sell, Furniture-Rent, PG,
  Coworking, Storage), each showing its bands as rows (cutoff + 3 duration prices), consistent
  with how `update-boost-pricing.dto.ts`'s validation already works — describing the pattern
  once here rather than spec'ing every field, since it's the same shape repeated 7 times.

### Rollout order (to de-risk a pricing change touching every listing)

1. Ship the new data model and admin UI with bands **seeded at today's flat prices for every
   band** (i.e., functionally a no-op — everyone pays what they pay today, just via the new rule
   structure). Verify nothing broke.
2. Switch in the placeholder band prices from the table above, one rule (segment) at a time,
   watching checkout-start/completion rate for that segment before moving to the next — the same
   discipline already used for every bidding/pricing change this session.
3. Once real listing-price/rent percentiles can be pulled from production, replace the
   placeholder cutoffs and prices with real ones.

## Verification

- Unit tests for `boostPriceFor`'s new rule/band matching (`packages/types` already has test
  coverage for the old category-only version — extend it, don't replace the category-only
  fallback path's tests).
- Manual: post a test listing in each of the 7 rule segments at a price in each band, confirm the
  post-success card shows the right price per band, and that `createBoostOrder`/
  `createListingPublishOrder` charge the same number the preview showed (no preview/charge
  mismatch — this was literally a documented historical bug here, see
  `monetization-boosted-listings-premium-tiers.md`'s pricing-split addendum).
- Confirm Phase 1's proof stat still renders correctly once Phase 2 ships (shared screen,
  shouldn't interact, but worth checking both platforms since mobile's isn't built at all yet
  pre-Phase-1).
