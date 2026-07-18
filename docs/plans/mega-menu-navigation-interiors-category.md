# Dynamic mega-menu category navigation + Interiors category

## Context

The homepage previously had two static rows under the Buy/Rent & Lease/PG/Furniture tab strip
(`apps/web/src/components/home/CategoryTabs.tsx`): a flat pill row of property types ("All types",
House, Apartment, ...) and a separate `FilterBar.tsx` with price/bedroom/furnishing dropdowns. This
replaces both with a single two-column mega-menu per tab: column 1 lists the tab's sub-facets
(property type / sharing type / condition, depending on the tab), and hovering/clicking one reveals
column 2 — real, `target="_blank"` links straight into a specific pre-filtered result set (e.g. "Buy
1 BHK House in Bengaluru" ... "Buy 5 BHK House in Bengaluru"), with the city interpolated from
whatever's currently selected via `LocationPicker`. A new "Interiors" category was added alongside
Furniture, as its own top-level tab.

**Confirmed decisions:**
- Non-BHK tabs get a category-appropriate sub-facet: PG's column 1 is sharing type
  (Single/Double/Triple/Dormitory, reused from `CATEGORY_FIELD_CONFIG.pg`); Furniture's column 1 is
  condition (New/Used, reused from `CATEGORY_FIELD_CONFIG.furniture`); Storage/Coworking (under Rent
  & Lease) keep column 1 as the property type itself, column 2 a single link.
- Interiors is a new, separate top-level tab with its own `ListingCategory`, modeled as **sell-only**
  with one required field, `serviceType` (Modular Kitchen / Wardrobe / False Ceiling / Painting /
  Full Home Interior / Other) — a reasonable default since it wasn't spec'd further.
- `FilterBar.tsx` was removed entirely — the mega-menu's direct links are the only filtering entry
  point on the homepage now.
- Web only — the mobile app's home browsing UI is untouched; only its wizard gained the Interiors
  category (so there's something to browse).
- Links reuse the homepage's existing query-string filtering (`/?...`), not the separate SEO routes,
  which don't support bedroom/attribute-level filtering.

## New category: Interiors

- `apps/bff/prisma/schema.prisma`: `interiors` added to the `ListingCategory` enum. Migration
  `20260718043000_add_interiors_category` (additive `ALTER TYPE ... ADD VALUE`).
- `packages/types/src/index.ts`: `ListingCategory`/`HomeCategoryFilter` both gained `"interiors"`.
- `packages/types/src/categoryFields.ts`: new `CATEGORY_FIELD_CONFIG.interiors` (`serviceType`,
  required select).
- `packages/types/src/postingRules.ts`: `POSTABLE_TRANSACTION_TYPES.interiors = ["sell"]`.
- `packages/types/src/priceQualifiers.ts`: `interiors: { sell: SELL_OPTIONS }`.
- `packages/types/src/tokens.ts`: new `categoryImagePlaceholder.interiors`.
- `apps/bff/src/moderation/priceBounds.ts`: new `interiors` sanity-bound entry (sell-only, so its
  `rental` bound is defined but never reached).
- `apps/bff/src/listings/listings.service.ts`: `deriveTag()` and `buildHomeCategoryWhere()` both
  gained an explicit `interiors` branch (`'INTERIORS'` tag; `{category: 'interiors'}` grouping) —
  without these, `interiors` would have silently fallen through into the buy/rentLease branch logic.
- `LISTING_CATEGORIES` arrays gained `"interiors"` in `create-listing.dto.ts`, `browseRoute.ts`, and
  `list-admin-listings.dto.ts`.
- `PostAdWizard.tsx` (web + mobile) `CATEGORIES` lists gained an Interiors entry.

## Backend — three new attribute filters (`list-listings.dto.ts`, `listings.service.ts`)

`sharingType`, `condition`, `serviceType` — exact-match filters against the `attributes` JSONB
column, mirroring the existing `furnished` field exactly. Their `@IsIn(...)` allowed-value lists are
derived directly from `CATEGORY_FIELD_CONFIG` (`CATEGORY_FIELD_CONFIG.pg`/`.furniture`/`.interiors`
`.find(...).options.map(o => o.value)`) rather than hardcoded — one source of truth, no drift.
`ListingsService.list()` gained three more `attributeFilters.push(...)` lines alongside
`bedrooms`/`furnished`. (Note: there's an unused top-level `Listing.condition` enum column, never
populated by `create()` — this filter reads `attributes.condition`, same as `furnished`, not that
column.)

## URL param scheme — the key design resolution

The homepage's existing `category` query param already meant "which tab" (`HomeCategoryFilter`) —
e.g. `?category=buy`. A raw `ListingCategory` bypass (used by the SEO pages, and needed here for
Furniture's Buy-vs-Rent split) also happens to have a field literally named `category` in
`ListListingsDto`, which would collide if reused as the same URL key. Resolved by keeping `category`
in the URL exclusively as the tab selector, and introducing a separate `listingCategory` URL param
for the raw bypass — mapped to the DTO's `category` field in `page.tsx`. Every generated mega-menu
link still sets `category=<tab>` (even Furniture's, which *also* sets `listingCategory`+
`transactionType`), so `CategoryTabs`'s active-tab bolding always works off the same one param
without needing a separate reverse-lookup helper — simpler than originally sketched.

Full scheme: `category` (tab, always present), `propertyType`+`bedrooms` (House/Apartment BHK
links), `sharingType` (PG), `condition` (Furniture, alongside the bypass), `serviceType`
(Interiors), `listingCategory`+`transactionType` (Furniture's sell/rent bypass only — PG and
Interiors don't need it since `buildHomeCategoryWhere` already special-cases them to a single fixed
category with no transaction-type ambiguity).

## Shared mega-menu config (`apps/web/src/lib/homeCategories.ts`, rewritten)

`HomeTab.propertyTypes` replaced with `column1: MegaMenuColumn1Item[]`, each item carrying its own
`links: (cityName) => MegaMenuLink[]` generator. `bhkColumn1Item(tab, actionLabel, propertyType,
label)` builds the 5 "N BHK ..." links (bedrooms 1-5, superseding `FilterBar`'s old 1-4 cap) for
House/Apartment under both Buy and Rent & Lease; `singleLinkColumn1Item(...)` builds the one-link
column 1 items (Storage/Coworking, PG's 4 sharing types, Interiors' service types). Furniture's
column 1 (New/Used) is defined inline since each item needs *two* links (Buy and Rent), not the
single-link helper's shape.

## Frontend — mega-menu UI

- `apps/web/src/components/home/CategoryTabs.tsx` (rewritten): the top row of 5 tab buttons stays;
  clicking one still navigates (clearing all filter params via a `FILTER_PARAM_KEYS` list) *and*
  toggles a `MegaMenu` dropdown open/closed. Closes on outside-click via the existing
  `useClickOutside` hook.
- `apps/web/src/components/home/MegaMenu.tsx` (new): column 1 (left) lists the active tab's items;
  hover *or* click sets which item's links show in column 2 (right, so it works via touch too).
  Column-2 entries are `next/link` `<Link target="_blank" rel="noopener noreferrer">`.
- `Header.tsx` gained a `cityId` prop (alongside the existing `cityName`) threaded down to
  `CategoryTabs`/`MegaMenu` so links interpolate the live selected city; `activePropertyType` prop
  was dropped (no longer meaningful — the mega-menu doesn't track a single "active property type").

## `apps/web/src/app/page.tsx`

- `FilterBar` import/render and `minPrice`/`maxPrice` parsing removed.
- Added parsing (with validation against `CATEGORY_FIELD_CONFIG`-derived value lists, matching how
  `furnished` was already validated) for `sharingType`, `condition`, `serviceType`, `listingCategory`
  (via `isListingCategory`), `transactionType` (via `isTransactionType`) — both helpers reused from
  `browseRoute.ts`. All pass through to `fetchListings`.
- `buildHeading()`: a small pure function producing the H1 for whichever filter combination is
  active, reusing `CATEGORY_LABELS`/`TRANSACTION_LABELS` from `browseRoute.ts` for the
  listingCategory-bypass case, falling back through bedrooms/sharingType/serviceType/propertyType/
  plain-tab-label cases.

## Verification performed

- `pnpm --filter @bhavano/types build && pnpm typecheck` — all 5 packages pass.
- Rebuilt and restarted the local BFF; confirmed via `curl` against `GET /listings`: valid
  `sharingType`/`condition`/`serviceType` values return 200 (empty result sets — no seed data
  matches yet), an invalid `sharingType` value correctly 400s.
- `POST /listings` with `category: "interiors"` passes category validation and correctly fails only
  on the (unrelated, pre-existing) mandatory-photo check — confirms the new category is accepted
  end-to-end through validation.
- Started the web dev server (on port 3010 locally — port 3000 was occupied by an unrelated Docker
  container) and confirmed via `curl`: all 5 tab labels including "Interiors" render; H1 headings
  render correctly for each scenario ("2 BHK Houses in Bengaluru", "New Furniture for Sale in
  Bengaluru", "Painting Interiors in Bengaluru", "PG Double sharing in Bengaluru").
- Not yet clicked through interactively in a real browser (hover/click column-2 rendering, new-tab
  behavior) — recommended before considering this fully done.
