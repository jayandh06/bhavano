# Contextual search filters: always show transaction and asset, derive the rest

**Status: Phase 1 implemented and deployed 2026-09-17.** Phases 2 and 3 are still plan only.
Written 2026-09-17.

## Context

The filter row is missing exactly where a visitor needs it most. `BrowseFilterBar` opens with:

```ts
if (!category) return null;
```

So on `/bengaluru`, `/bengaluru/buy`, and the homepage's **All** tab there is no price filter, no
furnishing filter — nothing but the area picker and the tab row. The filters only appear once a
visitor has already navigated to a specific category, which is the point at which they needed them
least.

There is also no transaction-type control anywhere. Switching between Buy and Rent & Lease is only
possible through the tab row, which reads as navigation rather than as a filter, and is absent on
browse pages further down.

**Confirmed decisions (2026-09-17):**

1. **Transaction and asset filters are always visible.** Every browse surface, every depth.
2. **The remaining filters are derived from the selected asset type** — price brackets, furnishing,
   BHK, sharing type, condition and the rest appear only where they mean something.
3. **Filter state comes from the URL, never from local component state.** Same rule `AreaFilter`
   already follows: *"derived straight from the URL — no local staging, so it can never drift out
   of sync with what's actually being shown."*
4. **Choosing an asset type is invited, not required** — see below. This is the one point where
   the plan deliberately differs from "make the user select an asset type".

## Why asset selection should not be a gate

Two reasons, and the second is the stronger one.

**It would hollow out pages that are built to rank.** `sitemap.ts` emits city-root, city+area,
city+group and city+group+category entries, so `/bengaluru` and `/bengaluru/buy` are indexable
landing pages by design (see
[area-first-urls-area-filter-search-dialog.md](area-first-urls-area-filter-search-dialog.md)). A
gate leaves two options, both bad: show an interstitial, and Googlebot — which does not click —
sees a page with no listings on it; or redirect to a default asset type, and the group landing page
stops existing and needs a canonical decision it currently doesn't need.

**At current inventory the mixed grid is often the only non-empty view.** 320 active listings
across 39 cities with any listing at all (of 135 cities). In most cities "apartments for rent" is
zero and "anything at all" is two or three. Forcing a narrower choice would manufacture exactly the
dead-end searches that
[property-requirements-demand-side.md](property-requirements-demand-side.md) exists to catch — and
the requirement capture would then fire on a result set the visitor was *made* to narrow, which
tells us nothing true about demand.

**Instead: invite with counts.** Asset chips render with **All types** as a real, valid, listing-
showing default, each chip carrying its own result count for the current city/area/transaction:

```
All types (47)   Apartments (31)   Houses (12)   Villas (4)   Plots (0)
```

A count does the persuading a gate would do, and does it better: it makes narrowing obviously
informative, and it stops someone selecting a type that has nothing — which a gate would actively
walk them into. A zero count should be visibly de-emphasised, not hidden: "no plots here" is a
useful answer, and it is also the moment to offer the requirement capture.

## The URL contract, and one constraint it imposes

This matters more than it sounds, because the URL grammar cannot express every combination.

The grammar is `/{city}[/{area}][/{group}[/{category}[/{facet}]]]` — **category only exists
underneath a group.** So "apartments, no transaction type chosen" has no path to live at.

| filter | where it lives | why |
|---|---|---|
| Transaction group | path segment (`/buy`, `/rent-lease`) | already canonical, already indexed |
| Asset type, with a group chosen | path segment (`/buy/apartment`) | ditto |
| Asset type, with **no** group chosen | `?propertyType=` | the grammar has nowhere else to put it — and the homepage already uses exactly this param |
| Area (one) | path segment | canonical city+area page |
| Areas (several / none) | `?areas=`, `?areas=none` | pure filter, never canonical |
| Price, furnishing, BHK, sort | query params | pure filters |

So asset selection changes shape depending on whether a transaction is chosen. That is not elegant,
but it is the existing convention in both directions, and inventing `/{city}/{category}` would add
a fourth URL shape for the same content and a canonical tag to keep it from competing with itself.

The transaction filter offers **groups** (Buy, Rent & Lease), not the four raw `TransactionType`
values — `buy|sell` and `rent|lease` are one browsing intent each, the path grammar speaks groups,
and offering `sell` as a browse filter would produce URLs that don't exist.

## Which filters belong to which asset

`CATEGORY_FIELD_CONFIG` in `packages/types/src/categoryFields.ts` already encodes every field per
category, with `dependsOn` conditions — the posting wizard, the edit form, the admin edit form and
the listing detail page all read it. The filter row should derive from the same table rather than
adding a fifth, independent opinion about what an apartment has.

Sketch of the intended result (to be driven by that config, not hardcoded):

| asset | filters beyond transaction/asset/area |
|---|---|
| Apartment, house, villa | BHK, price, furnishing |
| Plot | price, plot area |
| Commercial | price, furnishing, area size |
| PG | price, sharing type, gender |
| Coworking | price, seats |
| Storage | price, size |
| Furniture | price, condition (new/used) |
| Interiors | price, service type |
| **All types** | none — see below |

**Correction made while implementing (2026-09-17): "All types" gets no price filter at all.** The
row above originally said "price only — the one filter that means the same thing everywhere". It
does not. `BrowseFilterBar` sizes its brackets from `PRICE_BOUNDS[category]`, and there is no
honest single scale across a grid mixing a ₹4,000 sofa with a ₹90L flat: a union of the bounds
gives brackets useless for both ends, and picking a representative category is wrong for every
city whose inventory is something else.

So `if (!category) return null` **stays**, and price/furnishing/BHK appear once an asset is
chosen. The reported problem is solved by the two new filters existing, not by forcing the old bar
to render without the information it needs — and it makes choosing an asset visibly worthwhile,
which is the invitation this plan wanted without needing a hint line for it.

## Facet counts

New: `GET /listings/facets` returning counts by category (and by transaction group) for the current
city/area/filters. It is the same query shape as `ListingsService.getPopularSearches`, which
already does `groupBy(['category','transactionType','cityId'])` with the active/approved/unexpired
where-clause — so this is an extension of an existing pattern, not new machinery.

One extra aggregate per browse page render. Given every BFF fetch in the web app is
`cache: "no-store"`, that cost is real and should be measured, not assumed: if it hurts, counts can
be dropped to transaction-group level only, or omitted for the "All types" chip.

## Phases

**Phase 1 — always show the two filters. Implemented 2026-09-17.**
- `TransactionFilter` (Any / Buy / Rent & Lease) and `AssetTypeFilter` (All types + the categories
  valid for the chosen transaction), in `components/home/TypeFilters.tsx`. State derived entirely
  from the URL; both navigate on change, following `BrowseFilterBar`'s pattern.
- `lib/filterUrl.ts` owns every transition, so the two filters cannot disagree about what a
  combination means. 14 transitions verified, including area preservation, filters surviving a
  type change while `page` resets, the national no-city routes, and the group-is-redundant
  shortening for rent-only categories (`/bengaluru/pg`).
- Wired into the homepage and every browse page. Verified live: `/`, `/bengaluru` and
  `/bengaluru/buy` now carry both filters and no furnishing filter; `/bengaluru/buy/apartment`
  carries the furnishing filter and names the asset. The `!category` short-circuit was **kept**,
  not removed — see the correction above.
- A gotcha worth recording: `CATEGORY_LABELS` must be imported from `seoRoute`, not `browseRoute`.
  The latter re-exports it but also pulls in `lib/bff`, whose `next/headers` import a client
  component cannot reach. The build caught it.

**Phase 2 — derive the rest from the asset.**
- Read `CATEGORY_FIELD_CONFIG` to decide which additional filters to render.
- A category-agnostic price scale for "All types".

**Phase 3 — counts.**
- `/listings/facets`, chips carrying counts, zero counts de-emphasised and wired to the requirement
  capture.

Phase 1 is the whole of the reported problem; 2 and 3 are refinements and can wait for it to be in
use.

## SEO assessment

- **No new URL shapes and no redirects.** Every state these filters can produce already exists:
  path segments for city/area/group/category, query params for everything else. `?propertyType=` is
  already in use on the homepage.
- **Nothing moves out of the server render.** The filter controls are small client leaves (they
  navigate on click, like `AreaFilter` and `BrowseFilterBar` today); the pages and the result grid
  stay server components, so crawlers see the same content they do now.
- **Group and city landing pages keep their listings**, which is the entire reason asset selection
  is not a gate.
- **Canonicals unchanged.** Query-param variants continue to canonicalise back to the clean path,
  so a filtered view never competes with the page it filters.
- Counts in Phase 3 add server-rendered text to these pages, which is mildly positive and
  definitely not negative.

## Open questions

1. **Does "Any" transaction stay selectable once a group is chosen?** Offering a way back to the
   group-less page is honest, but it means a filter chip whose effect is to move *up* the URL
   hierarchy. I would offer it — the tab row already does exactly that, and hiding it would make
   Buy a one-way door.
2. **How hard should the invitation to pick an asset be?** Counts alone, or counts plus a hint line
   above the grid ("Pick a type to narrow this down")? A hint is cheap and reversible; I would
   start with counts only and add the line if the click-through on the chips is poor.
3. **Facet counts on every render, or only where the chip list is short?** Depends on what the
   extra aggregate actually costs on a cold page — worth measuring in Phase 3 rather than deciding
   now.
4. **Does the mega menu stay as it is?** It already offers group+category+facet navigation on
   hover. Two mechanisms for the same choice is a real cost, and the answer may be that the tab row
   keeps navigation while the new filters own refinement — but that is a bigger information-
   architecture question than this plan needs to settle.

## Critical files

- `apps/web/src/components/home/BrowseFilterBar.tsx` — the `!category` short-circuit, and the
  category-aware price brackets to generalise.
- `apps/web/src/components/home/BrowseListingsView.tsx` — the filter row itself.
- `apps/web/src/app/page.tsx` — the homepage's own copy of that row.
- `apps/web/src/lib/seoRoute.ts` — `segmentsForHomeCategory`, `buildQueryForSegments`, and the URL
  grammar these filters must stay inside.
- `packages/types/src/categoryFields.ts` — the single source of truth for which filters an asset
  type has.
- `apps/bff/src/listings/listings.service.ts` — `getPopularSearches` is the query shape the facet
  endpoint should follow.
