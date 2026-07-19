# Multi-select BHK filter + Sort By (SEO browse pages)

## Context

Bhavano's `/{city}/{buy|rent-lease}/{category}/...` browse pages already have quick-filters for
price and furnishing (`BrowseFilterBar.tsx`) and a multi-select area filter (`AreaFilter.tsx`), but
two gaps remain:

1. Bedroom count ("BHK") is only a **single-select** facet baked into the canonical URL
   (`/2bhk`), reachable only by clicking one mega-menu link at a time — there's no way to see, say,
   2 BHK and 3 BHK listings together on one page.
2. There is **no sort control anywhere** — every browse query is hardcoded to `createdAt desc`
   in `ListingsService.list()`.

Per your confirmation, both new controls are scoped to the **SEO browse pages only** (same
footprint as the existing Price/Furnished bar) — the homepage's own tab-based browsing is left
untouched, matching how Price/Furnished already work today. "Uncheck all" for the area filter is
explicitly out of scope for this change.

## Feature 1 — Multi-select BHK filter

Modeled directly on `AreaFilter.tsx` (`apps/web/src/components/home/AreaFilter.tsx`): a checkbox
list + "Select all", selection state derived purely from the URL, at least one box must stay
checked (mirrors `AreaFilter`'s original guard — no "uncheck to zero" here, that wasn't asked for).

**URL contract** (mirrors `AreaFilter`'s own path-vs-query split exactly):
- Buckets: 1, 2, 3, 4, 5 (5 = "5+", via the existing `bedroomLabel()` helper).
- All 5 checked (default, nothing in the URL) → no filter.
- Exactly 1 checked → collapses to the **existing** canonical single-facet path
  (`/{city}/{group}/{category}/{Nbhk}`, via `buildFacetSlug`/`buildBrowsePath`) — picking one BHK
  from the new checkbox list lands on the exact same URL the old mega-menu link already produces.
- 2–4 checked → stays on the category-root canonical path, adds `?bedrooms=1,3,5` (comma-separated
  bucket numbers) — new query param, layered on top the same way `?areas=` already is.

Only rendered when category is house/apartment (the only categories `facetKindForCategory` maps to
`"bedrooms"`), right next to `AreaFilter`/`BrowseFilterBar`.

**Files:**
- **`packages/types/src/bedrooms.ts`** (new) — move `MAX_BEDROOMS`/`bedroomLabel` here from
  `apps/web/src/lib/seoRoute.ts`; add a `./bedrooms` entry to `packages/types/package.json`'s
  `exports`. `seoRoute.ts` re-exports both so existing importers (`SearchBar.tsx`,
  `homeCategories.ts`) don't change. Reason: the BFF now needs the same "5 means 5+" constant, and
  duplicating it risks the two silently drifting apart.
- **`apps/web/src/lib/seoRoute.ts`** — `SegmentQuery.bedrooms` becomes `number[]`;
  `buildQueryForSegments`'s house/apartment branch wraps `facetValue` in an array; add
  `parseIntList(value)` (mirrors `parsePositiveInt`) for parsing `?bedrooms=1,3,5`. `buildHeading`'s
  signature is untouched (still a single `bedrooms?: number`) — callers pass `query.bedrooms?.[0]`,
  so the H1 only names a specific BHK when exactly one is resolved, same as today.
- **`apps/web/src/app/[city]/[[...rest]]/page.tsx`** — parse `?bedrooms=` via `parseIntList`;
  when present it overrides `baseQuery.bedrooms` (query-string wins over the path facet, same
  precedence `areaIds` already has over `areaId`).
- **`apps/web/src/components/home/BhkFilter.tsx`** (new) — the checkbox-list component itself,
  same shape as `AreaFilter.tsx` (`toggle`/`navigate`/"Select all", selection derived from
  `currentSegments.facetValue` and `?bedrooms=`).
- **`apps/web/src/components/home/BrowseListingsView.tsx`** — render `<BhkFilter>` when
  `filterCategory` is house/apartment; extend the local `buildPageHref` to forward `?bedrooms=`.
- **`apps/web/src/lib/bff.ts`** — `ListingsQuery.bedrooms` becomes `number[]`; `fetchListings`
  serializes it as a comma-joined string (same pattern as `areaIds`).
- **`apps/web/src/app/page.tsx`** (homepage) — no new UI; just wraps its existing single
  `?bedrooms=` value in an array (`bedrooms !== undefined ? [bedrooms] : undefined`) before calling
  `fetchListings`, so it keeps compiling/behaving exactly as today against the now-array-typed field.
- **`apps/bff/src/listings/dto/list-listings.dto.ts`** — `bedrooms` becomes `number[]`, parsed
  with the same comma-split `@Transform` pattern already used for `areaIds`, validated with
  `@IsInt({ each: true }) @Min(1, { each: true })`.
- **`apps/bff/src/listings/listings.service.ts`** — replace the single `attributes.bedrooms gte`
  push with an `OR` of per-bucket clauses: exact match for buckets 1–4, `gte: MAX_BEDROOMS` for the
  "5+" bucket (imported from `@bhavano/types/bedrooms`).

## Feature 2 — Sort By

Four universal sort options, the same set for every one of the 7 categories:
**Newest first · Price: Low to High · Price: High to Low · Most viewed** — all plain top-level
`Listing` columns (`createdAt`, `price`, `viewCount`).

I looked at whether a genuinely category-specific option (e.g. sort by `sqft` for house/apartment)
was feasible, since that's the more literal read of "category related sorts" — but the generated
Prisma client's `ListingOrderByWithRelationInput.attributes` type is a plain `SortOrder`, not a
JSON-path-aware sort (unlike the JSON *filtering* this schema already does via
`{ attributes: { path: [...], equals/gte } }`). Sorting by a field **inside** the JSON `attributes`
column isn't supported by Prisma's typed query builder for this setup — it would need raw SQL
(`ORDER BY (attributes->>'sqft')::numeric`), which I'm not introducing for a bonus dimension. So
"category related" here means: each category's browse page gets its **own** Sort control, scoped to
that category's own listings — not a different option list per category. Happy to revisit the
raw-SQL route later if you want a real size-based sort for house/apartment/storage.

**Files:**
- **`apps/bff/src/listings/dto/list-listings.dto.ts`** — new
  `sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular'`, `@IsIn(SORT_VALUES)`.
- **`apps/bff/src/listings/listings.service.ts`** — replace the hardcoded
  `const orderBy = [{createdAt:'desc'},{id:'asc'}]` with a lookup table keyed by `sort ?? 'newest'`;
  every entry keeps the existing `{ id: 'asc' }` tie-breaker so offset-pagination stays stable
  (same reasoning as the existing comment above that line).
- **`apps/web/src/lib/bff.ts`** — `ListingsQuery.sort?: string`; one more line in `fetchListings`.
- **`apps/web/src/lib/seoRoute.ts`** — `export const SORT_VALUES = [...] as const`.
- **`apps/web/src/app/[city]/[[...rest]]/page.tsx`** — `parseEnum(sp.sort, SORT_VALUES)`, passed
  into the query object (same one-line pattern already used for `furnished`).
- **`apps/web/src/components/home/BrowseFilterBar.tsx`** — third dropdown, reusing the existing
  `open`/`navigate`/`buttonClass`/`dropdownClass`/`DropdownOption` scaffolding already there for
  Price/Furnished; a local `SORT_OPTIONS` labeled array (same placement style as
  `FURNISHING_OPTIONS`); new `activeSort` prop. Rendered unconditionally (no category gate), so it
  shows up for all 7 categories.
- **`apps/web/src/components/home/BrowseListingsView.tsx`** — pass `activeSort={query.sort}` to
  `BrowseFilterBar`; extend `buildPageHref` to forward `?sort=`.

## Verification

- `pnpm --filter @bhavano/types build` (after adding `bedrooms.ts` + its export entry)
- `pnpm --filter @bhavano/web typecheck` and `pnpm --filter @bhavano/bff typecheck`
- Using the already-running dev servers, on a house/apartment browse page (e.g.
  `/bengaluru/buy/apartment`):
  - Check 2 of the 5 BHK boxes → confirm URL becomes `?bedrooms=` with both, listing count changes.
  - Narrow to exactly 1 box → confirm it navigates to the plain `/…/apartment/2bhk` canonical URL.
  - Uncheck down to "all 5" → confirm `?bedrooms=` disappears entirely.
- Try the new Sort dropdown on a couple of different categories (e.g. `pg`, `furniture`) — confirm
  order visibly changes for price asc/desc and that pagination links keep the chosen sort.
