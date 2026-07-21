# Add "Villa" category (Buy + Rent & Lease) and make Commercial Space buy-reachable

## Context

Two new listing-category asset types were requested:
1. **Villa** — reachable under both the **Buy** and **Rent & Lease** home tabs.
2. **Commercial Space** — already exists but is currently **Rent & Lease-only**; it needs to also
   become reachable under **Buy**.

This is architecturally identical to a prior change that added `plot` (buy-only) and `commercial`
(rent/lease-only) as siblings under the existing Buy/Rent & Lease groupings — see
`docs/plans/add-plots-and-commercial-categories.md` and commit `1668f18`. That precedent is the
template for this change: a new `ListingCategory` touches `packages/types` (category union, field
schema, posting rules, price bounds/qualifiers, image placeholders, tag derivation), the BFF
(Prisma enum + migration, 3 DTOs' literal category arrays, `PROPERTY_TYPES_BY_TAB`, demo-seed
data), and web + mobile (mega-menu, search-query keyword parsing, posting wizard, SEO labels,
site-wide copy that enumerates categories).

Villa is functionally a **residential sibling of House/Apartment** — same field schema (bedrooms,
bathrooms, sqft, furnishing), sellable and rentable/leaseable, with BHK-based browsing (unlike
Plot/Commercial, which use a single non-faceted link). **Decision (confirmed with user): Villa
gets the generic "FOR SALE"/"FOR RENT" tag**, matching House/Apartment, rather than its own
distinct badge — the category label already distinguishes it on category-scoped pages.

Making Commercial buy-reachable is a much smaller, mechanical change: its field schema doesn't
change (fields are keyed by category, not transaction type) — only its transaction-type
reachability (`POSTABLE_TRANSACTION_TYPES`) and the tab-membership maps that currently omit it
from Buy.

**SEO note** (per repo convention): this adds new crawlable routes (`/{city}/buy/villa`,
`/{city}/rent-lease/villa`, `/{city}/buy/commercial`) rather than changing existing ones — no
existing URLs are renamed or redirected, so no SEO regression risk; `CATEGORY_LABELS` /
`generateMetadata` continue to cover every category generically.

## Key mechanism (grounded in current code, not assumed)

`categoryGroupsFor()` in `apps/web/src/lib/seoRoute.ts:83-89` derives which of Buy/Rent-Lease a
category is reachable under **purely from `POSTABLE_TRANSACTION_TYPES`** (one source of truth —
no separate map to keep in sync for *that* mechanism). But the **mega-menu** (`homeCategories.ts`)
and the **BFF's tab→category filter** (`listings.service.ts`'s `PROPERTY_TYPES_BY_TAB`) are each
their own **hand-authored arrays**, not derived — both need explicit new entries.

## Changes

### `packages/types/src/`

- **`index.ts`**: add `"villa"` to `ListingCategory`; add `"villa"` to `PropertyTypeFilter` (it
  needs BHK-style browsing like house/apartment, unlike plot/commercial which are excluded from
  that type).
- **`categoryFields.ts`**: add `villa: RESIDENTIAL_FIELDS` to `CATEGORY_FIELD_CONFIG` (reuses the
  existing house/apartment field list verbatim — no new field definitions needed).
- **`postingRules.ts`**: add `villa: ["sell", "rent", "lease"]` to `POSTABLE_TRANSACTION_TYPES`;
  change `commercial: ["rent", "lease"]` → `["sell", "rent", "lease"]`.
- **`priceBounds.ts`**: add `villa: { sale: { min: 100_000, max: 500_000_000 }, rental: { min:
  1_000, max: 1_000_000 } }` (same band as house/apartment). Update `commercial`'s existing `sale`
  bound's doc comment — it's currently marked as an "unreached placeholder"; it becomes live once
  commercial is buy-postable. Leave the numbers themselves unchanged (already the standard
  real-estate-sale band every other sellable category uses).
- **`priceQualifiers.ts`**: add `villa: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease:
  MONTHLY_OPTIONS }`; add `sell: SELL_OPTIONS` to `commercial`'s existing entry.
- **`tokens.ts`**: add a `villa` entry to `categoryImagePlaceholder` (new `imgA`/`imgB` hex pair +
  `imgLabel: "photo: villa exterior"`, following the existing per-category placeholder-color
  pattern).
- **`listingTag.ts`**: no change — villa deliberately falls through `deriveTag`'s generic
  `"FOR SALE"`/`"FOR RENT"` branch (confirmed decision above); commercial's existing explicit
  `"COMMERCIAL"` branch already fires regardless of transaction type, so it needs no change either.

### `apps/bff/prisma/`

- **`schema.prisma`**: add `villa` to the `ListingCategory` enum.
- **New migration** (e.g. `20260721000000_add_villa_category`): `ALTER TYPE "ListingCategory" ADD
  VALUE 'villa';` — exact syntax precedent in
  `migrations/20260720120000_add_plot_and_commercial_categories/migration.sql`.
- **`seedDemoListings.ts`**: add a `villa` entry to `CATEGORY_STYLE`; add `'villa'` to the
  `case 'house': case 'apartment':` switch branch in `deriveFields` (adjusting the inline
  `noun` ternary to a 3-way branch: house → "Independent House", apartment → "Apartment", villa →
  "Villa"). `commercial`'s existing case needs no change (already transaction-type-agnostic).

### `apps/bff/src/` (BFF validation layer)

- **`admin/dto/list-admin-listings.dto.ts`**, **`listings/dto/create-listing.dto.ts`**,
  **`listings/dto/list-listings.dto.ts`**: add `'villa'` to each file's own literal
  `LISTING_CATEGORIES` array (no shared constant exists between them — same as the plot/commercial
  precedent). `list-listings.dto.ts` additionally needs `'villa'` added to its `PROPERTY_TYPES`
  array.
- **`listings/listings.service.ts`**: in `PROPERTY_TYPES_BY_TAB` — add `'villa'` to **both** the
  `buy` and `rentLease` arrays; add `'commercial'` to the `buy` array (already in `rentLease`).

### `apps/web/src/lib/`

- **`seoRoute.ts`**: add `"villa"` to `LISTING_CATEGORIES`; add `villa: "Villas"` to
  `CATEGORY_LABELS`; add `"villa"` to `PROPERTY_TYPE_VALUES` (gates the homepage's `?propertyType=`
  query-string validation — villa needs to be selectable there like house/apartment); extend
  `facetKindForCategory`'s `"bedrooms"` branch to include `category === "villa"`.
  `buildQueryForSegments`/`homeCategoryForSegments` need **no changes** — both already have an
  unconditional fallback branch (currently labeled "house/apartment" but structurally the catch-all
  for anything not furniture/pg/interiors/storage/coworking) that villa/commercial-under-buy
  already fall into correctly; only the fallback's comment could optionally mention villa.
- **`homeCategories.ts`**: in `HOME_TABS`, **Buy** tab's `column1` — add
  `bhkColumn1Item("buy", "Buy", "villa", "Villa")` alongside house/apartment, and add a new
  `singleLinkColumn1Item("commercial", "Commercial", (city) => \`Commercial Spaces for Sale in
  ${city}\`, { transactionGroup: "buy", category: "commercial" })` (mirrors the existing Plot
  entry's shape). **Rent & Lease** tab's `column1` — add
  `bhkColumn1Item("rent-lease", "Rent", "villa", "Villa")` alongside house/apartment (its existing
  Commercial entry needs no change).
- **`parseSearchQuery.ts`**: change the existing `[/\bvillas?\b/i, "house"]` entry in
  `CATEGORY_PATTERNS` to map to `"villa"` instead of `"house"`, now that Villa is its own category.

### `apps/web/src/components/home/PostAdWizard.tsx` and `apps/mobile/src/components/home/PostAdWizard.tsx`

- Add `{ value: "villa", label: "Villa", icon: "🏘️" }` to each file's `CATEGORIES` array (both
  independently maintain an identical array — same as the plot/commercial precedent). No changes
  needed to `selectCategory`'s transaction-type-offering logic — it already delegates entirely to
  `POSTABLE_TRANSACTION_TYPES[category]`.

### `apps/mobile/src/components/home/categories.ts`

- `"buy"` tab's `propertyTypes`: add `{ value: "villa", label: "Villa" }` and `{ value:
  "commercial", label: "Commercial" }`.
- `"rentLease"` tab's `propertyTypes`: add `{ value: "villa", label: "Villa" }` (commercial already
  present).

### Copy (flat category-name enumerations — none are transaction-group-specific, so "Villa" is a
simple insertion into each list; confirmed no duplication/move logic needed for Commercial moving
into Buy context, since none of this copy distinguishes buy vs. rent-lease)

- `apps/web/src/app/layout.tsx` — site `<title>` (already uses `"& More"` shorthand, so likely
  needs no edit) and meta `description` (fully enumerates categories — add "Villas").
- `apps/web/src/app/help/page.tsx` (FAQ "What can I list?" answer), `apps/web/src/app/terms/page.tsx`
  (§2), `apps/web/src/app/not-found.tsx` (example links), `apps/web/src/components/home/Footer.tsx`
  (blurb), `apps/web/src/components/home/Header.tsx` (tagline) — insert "Villas" into each
  category-name list.

### Not touched

- **`apps/admin/src`** — confirmed zero `ListingCategory`/`PropertyTypeFilter` references
  repo-wide; nothing to change.
- **Privacy Policy** — doesn't enumerate categories anywhere (per precedent).

## Verification

1. Rebuild `@bhavano/types` (`pnpm --filter @bhavano/types build`) and regenerate the Prisma client
   (`pnpm --filter bff prisma generate`) before typechecking — both are consumed as
   compiled/generated output elsewhere, and stale builds otherwise mask real errors (as seen with
   the current stale `dist/` — this rebuild will also incidentally fix the pre-existing unrelated
   `boostPricing`/`isBoosted` typecheck errors from before this change).
2. Run the new Prisma migration against the local Postgres (`pnpm --filter bff prisma migrate dev`).
3. `pnpm typecheck` across all packages — `CATEGORY_STYLE` and `deriveFields`'s `switch` in
   `seedDemoListings.ts` are exhaustive over `ListingCategory` with no `default`, so a missing
   `villa` case there is a hard compile error, not a silent gap.
4. Re-run `seedDemoListings.ts` and confirm it produces real Villa listings (and Commercial
   listings under a sell transaction type) with photos.
5. Live checks: `/{city}/buy/villa`, `/{city}/rent-lease/villa`, and `/{city}/buy/commercial`
   resolve with real listings; the homepage's Buy and Rent & Lease mega-menus show the new Villa
   link (and Buy shows the new Commercial link); the posting wizard's category step shows Villa on
   both web and mobile, and selecting it offers Sell/Rent/Lease as expected; the browse-page BHK
   filter facet works for Villa the same way it does for House/Apartment.
