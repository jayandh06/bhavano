# Contextual search filters: always show transaction and asset, derive the rest

**Status: Phases 1 and 2 implemented and deployed 2026-09-17.** Phase 3 (facet counts) is still
plan only. Written 2026-09-17.

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

**Correction (2026-09-17, after the first implementation shipped): the leading filter is the tab
vocabulary, not a transaction group.**

It was first built over `TransactionGroup` (buy | rent-lease) because that is what the path
grammar speaks. That was the wrong layer. This product's top-level axis is `HOME_TABS` — **All,
Buy, Rent & Lease, PG, Furniture, Interiors** — and modelling it as a group had two visible
consequences:

- PG, Furniture and Interiors had nowhere to be in the filter at all.
- `buildBrowsePath` drops the redundant group for a single-group category, so `/bengaluru/pg`
  carries *no group* — meaning that page showed **"Any"** as its transaction and offered **houses
  and apartments** as its asset types. Both nonsense, and both the same mistake.

The filter now reads its options from `HOME_TABS` and its active value from
`homeCategoryForSegments`, which already handled the group-less paths correctly — so the filter
and the tab row cannot disagree about either the vocabulary or which one is active.

`sell` still isn't offered: `buy|sell` and `rent|lease` are one browsing intent each and the path
grammar has no shape for a sell-only browse page.

**The asset filter renders nothing for PG, Furniture and Interiors.** Those categories *are* the
asset, so a dropdown there was either empty or offering things the page cannot show. They are also
excluded from the Buy and Rent & Lease asset lists, since "Buy → Interiors" would duplicate an
intent under a second name.

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
- **Reworked same day** onto the tab vocabulary (see the correction in the URL-contract section).
  The intent→assets mapping lives in `lib/assetFilters.ts`, not the component: it is domain logic,
  it belongs beside the config-derived filter sets, and putting it there makes it testable without
  importing a client component into Node. 19 checks cover the per-intent asset lists, all six URL
  shapes resolving to the right intent, that no self-intent category is ever offered as an asset,
  and that Buy offers plot while Rent & Lease does not. Verified live, one-to-one: `/bengaluru` →
  All, `/bengaluru/buy` → Buy, `/bengaluru/rent-lease` → Rent & Lease, `/bengaluru/pg` → PG,
  `/bengaluru/furniture` → Furniture, `/bengaluru/interiors` → Interiors — and no page shows
  "Any" any more.
- A gotcha worth recording: `CATEGORY_LABELS` must be imported from `seoRoute`, not `browseRoute`.
  The latter re-exports it but also pulls in `lib/bff`, whose `next/headers` import a client
  component cannot reach. The build caught it.

**Phase 2 — derive the rest from the asset. Implemented 2026-09-17.**
- `lib/assetFilters.ts` derives the set from `CATEGORY_FIELD_CONFIG`; `BrowseFilterBar` renders one
  dropdown per select filter, with options read from the config's own arrays — so a value added to
  the posting form becomes a filter option with no second edit, and can never drift from what
  `ListListingsDto` accepts (which reads the same arrays).
- **Three filters were missing entirely**, which is what made this worth doing rather than a
  refactor: the hardcoded `category === "house" || category === "apartment"` hid **villa's BHK**,
  **villa's furnishing** and **commercial's furnishing**, all of which the config declares and the
  BFF accepts.
- **Three more had no UI at all**: PG sharing type, furniture condition, interiors service type.
  The BFF has always accepted them — they were reachable only by following a mega-menu link into a
  path facet.
- The category-agnostic price scale was dropped rather than built; see the correction above.
- Verified live: villa carries BHK + Furnishing + Price, commercial carries Furnishing + Price (no
  BHK), PG carries Sharing + Price, plot carries Price only. 16 unit checks cover the derivation
  per category and that PG's options come from the config (single, double, triple, dormitory).
- **Still not filterable**, and deliberately so: `sqft`, `plotAreaSqft` and seat counts are real
  fields on their categories but `ListingsQuery` has no parameter for them. A control that cannot
  narrow anything is worse than no control, so adding them is a backend change first.

**Filter row order, and the dynamic heading. Implemented 2026-09-17.**
- **Row order is now location → transaction → asset → BHK → the asset's own filters → sort.** The
  area filter leads *inside a city*; on a national page (`/`, `/buy`) the row starts at the
  transaction filter.
- **City is not a filter.** It was briefly rendered as the row's leading pill on national pages via
  a `variant="filter"` `LocationPicker`. That was wrong: the city picks which page you are on (and
  which page ranks), so it is a top-level choice and stays in the header at every depth. The
  `filter` variant has been removed rather than left unused — the header's own picker already
  carries the search, auto-detect and segment-preserving switch.
- **The heading is now built from the query filters too**, with one grammar in `buildHeading`:
  `{Verb} {Furnishing} {BHK} {Asset} in {Place} {Price}` — "Rent Unfurnished Apartments in 4 areas
  of Bengaluru between ₹20k and ₹2L". `{Place}` is a single area name when the path names one
  (`"BTM Layout, Bengaluru"`), a count when several are selected (`"4 areas of Bengaluru"`), the
  city otherwise, and `"India"` on the national routes.
- **The `<title>` deliberately gets less than the H1**: path facets only, no price/furnishing/area
  count. These pages are indexed, and a title driven by the path stays stable instead of producing
  a permutation per filter combination on URLs that canonicalise straight back to it. The H1 is
  what the visitor is looking at and carries no ranking weight on a canonicalised variant.
- **This does change every indexed browse title**, by prefixing the verb: "Apartments in
  Bengaluru" → "Rent Apartments in Bengaluru". That was the point — "rent apartment in
  koramangala" is how people actually phrase the query — but it is a site-wide title change, not a
  cosmetic one, and worth watching in Search Console. The group-with-no-category label also
  changed: `/bengaluru/buy` read "All Listings in Bengaluru", which was simply untrue of a page
  showing only things for sale, and now reads "Buy Properties in Bengaluru". No URL changed.
- 11 grammar checks cover the verb, furnishing, BHK-facet, area-count and all three price clauses
  (`between`/`under`/`above`), plus the no-group fallback.

**Follow-ups from use. Implemented 2026-09-17.**
- **The three Phase 2 selects were never applied.** `BrowseFilterBar` wrote `?sharingType=`,
  `?condition=` and `?serviceType=`, and `ListListingsDto` accepted them, but neither branch of
  `app/[city]/[[...rest]]/page.tsx` read them back out of `searchParams` — so the pill lit, the URL
  changed, and the results didn't. Measured: `/bengaluru/pg?sharingType=double` returned the
  unfiltered 34 where the path-facet spelling `/bengaluru/pg/double` returned 1. Both branches now
  parse all three via one `parseAssetSelects`, with a query value winning over the path facet (the
  precedence `?bedrooms=` and `?areas=` already had). Verified live: 1 for double, 33 for single,
  34 unfiltered.
  - The H1 follows, which needed one subtlety: sharing and service type name the heading's
    *subject* ("PG Double sharing in Bengaluru"), so a query-param choice has to suppress the
    category-label fallback the way a path facet does or the filter stays invisible. Condition is
    deliberately excluded — "Used Furniture" wants the category label.
- **Price is "Any" plus two boxes, and nothing else.** The derived brackets went with the same
  change that added the boxes: they were sized off each category's plausibility bounds, which made
  them sane but arbitrary — three buckets per category, rarely the range anyone wanted, and a
  second way to set the same two numbers. Either box may be left empty for an open-ended bound, and
  both empty is "Any price". `filterIsSale`/`isSale` went with them: a typed amount needs no
  per-category, per-transaction scale. `lib/priceInput.ts` parses what people actually type — `20,000`, `₹45000`, `20k`,
  `2 lakh`, `1.5Cr` — because the brackets above the box are themselves written in that notation.
  19 checks cover the parser and the pill label.
  - Bounds are **inclusive** (`>=`/`<=`), matching the backend's existing price filter. No separate
    strict-greater mode: at rupee granularity `> 20000` and `>= 20000` differ by one rupee, so it
    would be two controls for one meaning.
  - This also fixed the pill: a typed range matches no bracket and used to leave it reading "Price",
    as though nothing were filtered. It now reads "₹20k – ₹2L" / "Above ₹20k" / "Under ₹45k".
- **The BHK pill counts selections, not bedrooms.** With several buckets ticked it read
  "3 BHK" — the same words as the bedroom count, so picking 2 and 3 displayed "2 BHK". It now reads
  "2 selected", and still names the value when exactly one is chosen.
- **BHK reaches every page that has bedrooms.** It was rendered only when a city was resolved *and*
  a category was known, so `/buy/apartment` and the homepage with an apartment selected had no BHK
  filter at all. `BhkFilter` now takes an optional `cityName` (building the national path
  `/buy/apartment/2bhk` without one) and an `urlMode`: `path` on the browse pages, where a single
  bucket has a canonical URL of its own, and `query` on the homepage, which has no browse path and
  expresses every filter as a param. The homepage's `?bedrooms=` accordingly became a list rather
  than a single value; a single-value link from the mega menu parses as a one-element list
  unchanged. The buckets themselves are unchanged — 1 … 5+, the top one being "or more" because
  that is what the backend does.
- **Selecting Furniture in the transaction filter did nothing.** `buildFilterUrl` was written on
  the belief that a category only exists underneath a group, and fell back to `?propertyType=`
  whenever no group was chosen. Furniture's intent deliberately carries no group (it is postable as
  both sell and rent, which is why `/furniture` exists at all) and is not one of that param's five
  values — so the category was dropped and the click landed on the city root. `parseSegments` has
  always accepted a bare category segment, so the fix is one `buildBrowsePath` call covering every
  combination: group with asset, group alone, asset alone, neither. 20 transition checks.
- **The All tab no longer offers asset types.** It used to list the five `?propertyType=` values,
  which made the control change shape depending on whether a transaction was chosen — and "any
  transaction, apartments" is not a thing anyone asks for. Pick Buy or Rent first and the asset
  filter appears with that transaction's own assets. This retires the `?propertyType=` branch of
  `buildFilterUrl` entirely: nothing in the UI can now produce an asset without a group except the
  self-intent categories, which have their own path segment.
- **Picking Plots under Buy snapped the transaction filter back to All.** `buildBrowsePath` drops
  the group whenever the category has only one — plots are sell-only, so Buy + Plots is
  `/bengaluru/plot`, not `/bengaluru/buy/plot`. Every reader that asked `parsed.transactionGroup`
  directly read that as "no transaction chosen", which set the tab to All and (since All offers no
  assets) hid the asset filter too, so the choice looked discarded. `impliedTransactionGroup`
  now answers with the group a single-group category implies, and `homeCategoryForSegments` and the
  heading both use it. Same bug fixed for `/storage` and `/coworking`, which are rent-only.
  `/bengaluru/apartment` still answers All: two groups, so nothing is implied and nothing has been
  chosen. 15 checks.
  - The heading follows, so `/bengaluru/plot` reads "Buy Plots in Bengaluru" rather than dropping
    the verb the filter row shows. That changes those indexed titles, the same way the verb change
    above did.
- **Still missing on the homepage**, and knowingly: price and furnishing. The homepage has never
  parsed `minPrice`/`maxPrice`, so adding those controls is a route change rather than a component
  one, and the browse pages are where price refinement belongs.

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
