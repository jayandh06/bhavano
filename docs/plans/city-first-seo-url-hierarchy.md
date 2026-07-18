# City-first SEO URL hierarchy

## Context

The mega-menu (previous turn) shipped deep filtering using the homepage's query-string mechanism
(`/?category=buy&propertyType=house&bedrooms=2&city=...`) — the fastest path at the time, since SEO
wasn't that turn's goal. This turn restructures the app's separate clean-path SEO route family
(previously `/{transaction}/{category}/{city}/{locality}/{slug}-{id}`) into a city-first hierarchy,
one level deeper (a bedroom-count/sharing-type/condition/service-type "facet" segment), and points
the mega-menu + listing cards at it instead of query strings.

**Confirmed decisions:** transaction segment is the grouped tab (`buy`/`rent-lease`, not raw
`transactionType`); routing is one optional catch-all, not a folder per level; old URLs 301
(actually 308, Next's `permanentRedirect`) to new ones; mega-menu switches to clean paths; listing
cards also open in a new tab; the bedroom facet's top bucket is labeled "5+" (the backend's
`bedrooms` filter is already `>=`, so 5 was always "5 or more", never exactly 5).

## URL grammar

```
/{city}/{transactionGroup}/{category}/{facet}/{locality}/{slug}-{id}
```
Every segment after `{city}` is optional. `transactionGroup` ∈ `buy`/`rent-lease`. `category` is a
`ListingCategory`, reachable only under groups `POSTABLE_TRANSACTION_TYPES` actually supports (pg/
storage/coworking → rent-lease only; interiors → buy only; house/apartment/furniture → both).
`facet` is category-dependent: `1bhk`..`5bhk` (house/apartment, "5bhk" meaning 5-or-more — see
`bedroomLabel()`), sharing type (pg), condition (furniture), service type (interiors), none
(storage/coworking). `/city/buy` and `/city/rent-lease` with no category reuse the homepage's
existing Buy/Rent & Lease grouping (house+apartment[+storage+coworking]) rather than merging every
sellable category — furniture/interiors sell-listings are reachable at their own category-level
path, just not folded into the group-root view.

## Key implementation surprises (not in the original plan)

1. **Next.js forbids two sibling top-level dynamic folders with different param names.** The plan
   called for keeping the old `/{transaction}/{category}/{city}/...` route tree as redirect-only
   stubs alongside the new `/[city]/[[...rest]]` tree — but `app/[transaction]/` and `app/[city]/`
   as siblings both being dynamic at the same position is a hard Next.js error ("You cannot use
   different slug names for the same dynamic path"). Fixed by deleting the old route tree entirely
   and folding its redirect logic into the *same* catch-all: if the `city` param is actually one of
   the 4 raw `TransactionType` strings (never a real city slug), `legacyRedirect()` in
   `apps/web/src/app/[city]/[[...rest]]/page.tsx` treats the rest of the segments as the old
   grammar and redirects.
2. **A type-only-looking import chain still pulled a `server-only` file into the client bundle.**
   `ListingCard.tsx` ("use client") imports `buildListingPath` → `listingPath.ts` → `seoRoute.ts`,
   which imported `isListingCategory`/`CATEGORY_LABELS`/etc. from `browseRoute.ts` — and
   `browseRoute.ts` has a real (value) import of `fetchCities`/`fetchAreas` from `lib/bff.ts`, which
   starts with `import "server-only"`. Fixed by moving the pure type guards/label maps (
   `TRANSACTION_TYPES`, `LISTING_CATEGORIES`, `isTransactionType`, `isListingCategory`,
   `CATEGORY_LABELS`, `TRANSACTION_LABELS`) into `seoRoute.ts` (which now has zero dependency on
   anything server-only) and having `browseRoute.ts` re-export them for its own (genuinely
   server-only) `resolveCity`/`resolveArea` callers — reversing the dependency direction instead of
   a one-off type-only import that wasn't actually enough to avoid the bundling issue.

## What changed, by file

- **`apps/bff/src/listings/listings.service.ts`**: dropped `homeCategory = 'buy'`'s default;
  `buildHomeCategoryWhere` returns `{}` (no constraint) when genuinely nothing is specified — needed
  for the bare `/{city}` root page. Zero risk to the homepage (which always sends an explicit
  `homeCategory` itself). Also added an `interiors` branch to `buildHomeCategoryWhere`/`deriveTag`
  that a previous turn's edit had missed.
- **`packages/types/src/priceBounds.ts`** (new): the `PRICE_BOUNDS` table moved here from
  `apps/bff/src/moderation/priceBounds.ts` (which now just imports it) so the web app can reuse the
  same per-category bounds for price quick-picks, one source of truth instead of two.
- **`apps/web/src/lib/seoRoute.ts`** (new): the URL grammar's home — transaction-group mapping,
  category/facet validation and parsing (`parseSegments`), the parsed-segments → `fetchListings`
  query mapper (`buildQueryForSegments`), the shared H1 builder (`buildHeading`, now used by both
  the homepage and this route), and generic searchParams parsing helpers. Deliberately zero
  server-only dependency (see surprise #2 above).
- **`apps/web/src/lib/browseRoute.ts`**: slimmed to `resolveCity`/`resolveArea` (the genuinely
  server-only DB lookups) plus re-exports from `seoRoute.ts`.
- **`apps/web/src/lib/listingPath.ts`**: `buildListingPath`/`buildBrowsePath` rewritten to the new
  city-first grammar. Listing canonical paths don't encode facet (it's a browse-level filter, not
  meaningful once you're pointing at one specific listing by id) — 5 segments, not 6.
- **`apps/web/src/app/[city]/[[...rest]]/page.tsx`** (new): resolves the city, parses `rest`,
  dispatches to legacy-redirect / listing-detail (with canonical-redirect check) / browse rendering.
- **`apps/web/src/components/home/ListingDetailView.tsx`** (new): the listing detail body extracted
  from the old `[slugId]/page.tsx` so the new catch-all renders it.
- **`apps/web/src/components/home/BrowseListingsView.tsx`**: reworked to take an already-resolved
  `query` + `heading` (from `seoRoute.ts`) instead of building its own from fixed
  `transactionType`/`category` props, since browse pages can now be arbitrarily broad (city-root,
  group-root) as well as fully specific.
- **`apps/web/src/components/home/BrowseFilterBar.tsx`** (new, replaces the deleted `FilterBar.tsx`):
  category-aware price/furnished refinement living on the results page — `furnished` only for
  house/apartment, price quick-picks sized off that category's `PRICE_BOUNDS`. Layers
  `minPrice`/`maxPrice`/`furnished` as query params on top of the clean canonical path, never
  changing the path itself.
- **`apps/web/src/lib/homeCategories.ts`**: `MegaMenuLink` now carries `transactionGroup`/
  `category`/`facetValue` instead of homepage query params; `hrefForLink()` builds a real clean path
  via `buildBrowsePath`. Bedroom link labels use `bedroomLabel()` (5 → "5+").
- **`apps/web/src/components/home/MegaMenu.tsx`**, **`CategoryTabs.tsx`**, **`Header.tsx`**:
  `cityId` prop dropped (clean paths only need the city's slugified name, not its id).
- **`apps/web/src/components/home/ListingCard.tsx`**: both `Link`s (image overlay + content) gained
  `target="_blank" rel="noopener noreferrer"`.
- **`apps/web/src/app/sitemap.ts`**: rebuilt on the new path builders, extended to include
  city-root and city+group entries (deduped to combinations actually present in the data) alongside
  the existing city+group+category and listing entries.
- **`apps/web/src/components/home/Footer.tsx`**: its 7 hardcoded `buildBrowsePath(...)` calls updated
  to the new object-argument shape; one ("2 BHK for sale in Pune") now genuinely passes
  `facetValue: 2` since the new grammar actually supports that.

## Verification performed

- `pnpm --filter @bhavano/types build && pnpm typecheck` — all 5 packages pass.
- Rebuilt/restarted the BFF and did a clean web dev-server restart (cleared `.next` — Next's dev
  route registry cached the old `[transaction]` conflict across hot-reloads even after the folder
  was deleted).
- Exercised every depth via `curl`: unknown city → 404; `/bengaluru` → 200 "All Listings in
  Bengaluru"; `/bengaluru/buy` → 200; `/bengaluru/buy/house` → 200; `/bengaluru/buy/house/2bhk` →
  "2 BHK Houses in Bengaluru"; `/bengaluru/buy/house/5bhk` → "5+ BHK Houses in Bengaluru";
  `/bengaluru/rent-lease/pg/single` → "PG Single in Bengaluru"; `/bengaluru/buy/furniture/new` →
  "New Furniture for Sale in Bengaluru"; `/bengaluru/buy/interiors/painting` → "Painting Interiors
  in Bengaluru"; `/bengaluru/buy/pg` (invalid combo) → 404.
- Fetched a real listing, confirmed its canonical path renders (200, correct title), a
  non-canonical variant (missing locality) 308-redirects to the canonical path, and the
  old-format URL for the same listing also 308-redirects correctly.
- Confirmed the homepage still works, still shows the Interiors tab, and `/sitemap.xml` contains the
  new city-first URLs at multiple depths.
- Confirmed `BrowseFilterBar` shows Price+Furnishing on a house page and only Price (no Furnishing)
  on a PG page.
- Not yet clicked through the mega-menu interactively in a real browser (hover/click column-2
  behavior, new-tab opening) — the underlying `buildBrowsePath`/`hrefForLink` calls were verified
  indirectly (same function, same output shapes already curl-tested above), but worth a manual pass.
