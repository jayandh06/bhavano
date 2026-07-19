# Area-first URLs, multi-select area filter, and search help dialog

## Context

Three related classifieds-UX/SEO improvements, all centred on **locality (area)**:

1. **Area-first URLs** — the URL grammar put area last
   (`/{city}/{group}/{category}/{facet}/{locality}/{slug}-{id}`), so there was no clean, indexable
   page for "all listings in Koramangala, Bengaluru". Moving area to right after the city creates
   real city- and city/area-level landing pages (`/bengaluru`, `/bengaluru/koramangala`).
2. **Multi-select area filter** — the first, primary filter on any results page: all areas of the
   current city, all checked by default (= no narrowing), uncheck to restrict to specific areas.
3. **Search help dialog** — a focus-triggered panel under the search box showing what can be
   searched (dynamic to the current city), plus a live "interpreted as…" preview once the user
   starts typing, built on the rule-based parser from the previous task
   (`apps/web/src/lib/parseSearchQuery.ts`).

**Confirmed decisions:**
- **Area URL model**: a *single* selected area → clean path `/{city}/{area}/{group}/{category}`
  (indexable); *multiple/partial* areas → `?areas=id,id` query on the arealess path, canonical
  points back at the arealess path (same non-indexed-duplicate pattern as `?minPrice=`).
- **Search dialog**: example chips when empty + live interpretation preview while typing.
- **Filter scope**: both the `/{city}/...` browse pages **and** the homepage.
- **SEO assessment** (asked separately): Part 1 is the real SEO lever — new indexable
  city/area landing pages, migrated safely via 308 redirects that preserve ranking signal. Part 2
  is SEO-neutral by design (the canonical tag keeps `?areas=` combinations from being indexed as
  duplicates). Part 3 is pure client-side UX, no SEO impact.

## Part 1 — Area-first URL grammar (implemented)

New grammar: `/{city}[/{area}][/{group}[/{category}[/{facet}]]][/{slug}-{id}]`.

- **`apps/web/src/lib/seoRoute.ts`** (`parseSegments`): area is now parsed right after the city —
  any segment that isn't a `TransactionGroup` keyword and isn't a listing slug-id is treated as an
  area candidate (verified against the DB by the caller, same as before). **Backward
  compatibility**: the function still also recognizes the *old* area-last shape
  (`/{group}/{category}/{area}/{slug}-{id}` or `/{group}/{category}/{area}`) purely so
  already-indexed/bookmarked URLs keep resolving instead of 404ing — `buildBrowsePath`/
  `buildListingPath` never produce that shape anymore, so this path only exists for migration.
- **`apps/web/src/lib/listingPath.ts`**: `buildBrowsePath` and `buildListingPath` reordered to
  emit area right after the city.
- **`apps/web/src/app/[city]/[[...rest]]/page.tsx`**: canonical/redirect logic now always rebuilds
  the path fresh from resolved parts (`resolvedCanonicalPath`, via `buildBrowsePath`) rather than
  echoing the raw requested path — so **any** old-shape URL (browse or listing) that still parses
  gets a real `permanentRedirect` (308) to the new canonical shape, not just a self-referential
  canonical tag. `breadcrumbJsonLd` reordered to City → Area → Group → Category → Facet.
  `headingFor` simplified to take an already-resolved `areaName` instead of re-resolving it, so
  the same resolved `areaRow` feeds the heading, breadcrumbs, and canonical consistently.
- **`apps/web/src/app/sitemap.ts`**: added city+area browse entries (one per city/area pair
  actually present in listing data), alongside the existing city/city+group/city+group+category
  entries.

Verified: `/bengaluru`, `/bengaluru/koramangala`, `/bengaluru/koramangala/buy/apartment` all 200;
old-shape listing and browse URLs 308-redirect to the new shape; the pre-existing
`/{transaction}/...` legacy redirect now lands on the new shape too; `?minPrice=`-filtered variants
still 200 with canonical pointing at the clean (arealess-query) path; sitemap includes the new
city/area entries.

## Part 2 — Multi-select area filter (implemented)

**Backend:**
- `apps/bff/src/locations/{locations.controller,locations.service}.ts`: `searchAreas` gained an
  `all=true` mode (mirrors the existing cities `all=true`) that drops the `take: 15` cap.
- `apps/bff/src/listings/dto/list-listings.dto.ts` + `listings.service.ts`: new `areaIds?: string[]`
  (comma-split via `@Transform`), used as `areaId: { in: areaIds }` in `ListingsService.list()`
  when present (wins over the single `areaId`, though the two are never sent together in practice).
- `apps/web/src/lib/bff.ts`: `fetchAreas(cityId, q?, all?)` gained the `all` flag; `ListingsQuery`
  gained `areaIds?: string[]` (joined into `?areaIds=` on the wire).

**Frontend — new `apps/web/src/components/home/AreaFilter.tsx`** (client component, patterned on
`BrowseFilterBar.tsx`'s click-to-navigate style): checkbox list, all checked by default, "Select
all" plus per-area checkboxes; navigates immediately on each toggle (no staged "Apply" step —
area counts per city are small enough that this stays snappy). Selection state is derived
entirely from the URL (path area, then `?areas=`, else "all") — never staged in local state, so it
can't drift out of sync.

- **Wire format**: `?areas=` carries area **ids**, not slugs — it's a pure filter (never
  canonical content), so there's no SEO reason to prefer slugs there, and using ids means no
  slug↔id resolution step is needed; the same ids round-trip straight into the backend's
  `areaIds` filter. The single-area *path* case is unrelated and still uses the area's name/slug.
- One checked → clean path (`buildBrowsePath` with `areaName`). Several (not all) checked → arealess
  path + `?areas=id,id`. All checked → arealess path, no `?areas=`. Unchecking down to zero is
  blocked (keeps at least one selected, "Select all" is one click away) rather than defining an
  ambiguous "match nothing" state.
- Rendered **first**, before `BrowseFilterBar`, in `BrowseListingsView.tsx`, and above `ListingGrid`
  on the **homepage** (`apps/web/src/app/page.tsx`, `homepage` mode — no `currentSegments`, so
  every selection there is `?areas=` regardless of count).
- `[city]/[[...rest]]/page.tsx` now fetches the city's *full* area list (`all=true`) instead of the
  capped sample, used both for `AreaFilter`'s list and the search bar's placeholder hint; `?areas=`
  ids are read directly from `searchParams` and passed straight through to `fetchListings`.

Verified: filtering Bengaluru apartments to only the Koramangala area id still shows the (real)
Koramangala listing; filtering to only the Whitefield area id (where there's no apartment listing)
correctly shows 0 — confirming the filter is a real narrowing, not a no-op.

## Part 3 — Search help dialog (implemented)

`apps/web/src/components/home/SearchBar.tsx`: the interpretation logic previously inline in
`submit()` was extracted into a shared `interpret(text, cityName, popularCities)` function (returns
resolved category/transactionGroup/facetValue/city/area/price), used by both `submit()` (build the
destination URL) and a new `describe()` function (human-readable tokens for the live preview) — so
both stay perfectly in sync.

- Focusing the input opens a panel below it (dismissed via the existing `useClickOutside` hook, an
  Escape keydown handler, or on submit).
- **Empty value**: example chips built from the current city/area — `2 BHK in {area}`,
  `Furniture under ₹5,000 in {city}`, `PG in {city}`, `Coworking in {city}`. Clicking one fills the
  box and searches immediately.
- **Non-empty value**: chips replaced by a live `→ 2 BHK Apartments · Rent & Lease · under ₹85L ·
  in Koramangala, Bengaluru`-style preview, computed from the same `parseSearchQuery`/`interpret`
  pipeline the actual search uses — so what's shown is exactly what pressing Enter will do.
- New shared `formatINR` helper extracted from `BrowseFilterBar.tsx` into `seoRoute.ts` (both the
  filter bar's price brackets and the search preview need the same "₹85L"/"₹1.2Cr" formatting).

Verified: the parser output feeding the preview was independently re-checked via `tsx` after the
refactor (unchanged behavior). The interactive part itself (focus/type/click) is client-side React
state that can't be exercised through `curl` — confirmed instead by static-render checks (no
runtime errors, placeholder renders correctly) and direct review of the `interpret`/`describe`
logic; a manual click-through in a browser is the recommended final check before shipping.

## Verification performed

- `pnpm typecheck` across all packages (rebuilt `@bhavano/types` first, since `PopularSearchDto`-
  style shared-type changes need that from the earlier session).
- Local, area-first URLs: bare city, city+area, and city+area+group+category all 200 with correct
  breadcrumbs (City → Area → Group → Category ordering) and canonical tags.
- Old area-last URLs (both browse and listing-detail) 308-redirect to the new canonical shape; the
  pre-existing `/{transaction}/...` legacy redirect also lands on the new shape.
- `sitemap.xml` includes the new city+area entries.
- `?minPrice=`/`?furnished=` filtered variants unaffected — still 200, canonical still points at
  the clean path.
- `AreaFilter` on a real city+category combo actually narrows the result set (verified against
  real vs. non-matching area ids), and renders on both the browse pages and the homepage.
- `SearchBar`'s parser/interpretation logic re-verified via `tsx` after refactoring it into shared
  `interpret`/`describe` functions.

**Not yet done**: an actual browser click-through of the search help dialog (focus → chips → type →
live preview → click-outside/Escape dismiss) and the `AreaFilter` checkbox interactions — worth a
manual pass before considering this fully shipped, since neither can be exercised via `curl`.
