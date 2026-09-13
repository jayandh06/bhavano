# Homepage: mix recent listings by category, cap boost visibility to the first pages

## The problem, with real numbers

Checked against prod right now: of the 103 listings created in the last 3 days, **87 are `pg`**
(a bulk-upload run), 6 `house`, 5 `plot`, 4 `apartment`, 1 `villa` — nothing else. The homepage's
default sort is `boostRank desc nulls last, createdAt desc` (`ListingsService.list`, `ORDER_BY.newest`
in `apps/bff/src/listings/listings.service.ts`) — a flat, global "newest first." A single
bulk-upload run (`bulk_upload_listings.py`, or a scrape import) inserts dozens of same-category
rows within seconds of each other, so for as long as they're the "newest" listings on the site,
they occupy essentially the entire homepage — exactly what was reported ("only latest ads, which
could be my bulk uploaded PG listings").

Two separate, sequenced pieces of work:

1. **Now** — mix the *recent* window by category, so the homepage reads as "a healthy cross-section
   of what's new," not "whichever category got bulk-imported most recently."
2. **Later** — bound how many pages boosted (paid) listings can occupy, so the boost tier stays a
   real page-1/page-2 differentiator instead of (once boost adoption grows) potentially filling
   many pages and pushing organic content out of sight. Currently 0 listings are boosted — no
   urgency, but worth designing now since it shares the same "first N pages get special treatment"
   shape as part 1.

## Part 1 — Mix recent listings by category

### Scope: every home tab, not just "All"

Applies to **all six home tabs** — All, Buy, Rent & Lease, PG, Furniture, Interiors — each mixed
by whatever its own natural sub-grouping is, since "Buy" and "Rent & Lease" are themselves
multi-category views with the exact same bulk-import-dominance risk as "All":

| Tab | Real categories in scope (`buildHomeCategoryWhere`) | Tab's own dimension |
|---|---|---|
| All | every category | `listing.category` |
| Buy | house, apartment, villa, plot, commercial | `listing.category` |
| Rent & Lease | house, apartment, villa, storage, coworking, commercial | `listing.category` |
| PG | pg (one category — nothing to mix by category) | sharingType facet |
| Furniture | furniture (one category) | condition facet |
| Interiors | interiors (one category) | serviceType facet |

**City folds into every tab's group key, not just PG/Furniture/Interiors's — but only when
browsing all cities.** The actual group key is `(tab's own dimension, cityId)` whenever no city
filter is active (the homepage's default, "All cities" view), and just the tab's own dimension
alone once a specific city *is* selected (`?city=` set, or a `/{city}/...` page) — at that point
every candidate row already shares the same `cityId`, so including it in the key would be a
no-op, not wrong, just wasted work. Concretely:

| Tab | Group key, all cities | Group key, one city selected |
|---|---|---|
| All | `(category, cityId)` | `category` |
| Buy | `(category, cityId)` | `category` |
| Rent & Lease | `(category, cityId)` | `category` |
| PG | `(sharingType, cityId)` | `sharingType` |
| Furniture | `(condition, cityId)` | `condition` |
| Interiors | `(serviceType, cityId)` | `serviceType` |

This matters just as much for Buy/Rent & Lease/All as it does for the single-category tabs: even
with categories properly interleaved, 50 recent "apartment" listings all from one city would still
make the Buy tab's all-cities view read as "everything is from Bengaluru" — category diversity and
geographic diversity are separate problems, and browsing all cities needs both solved at once.

A dedicated locality/property-type page one step narrower than a tab (e.g. `/bengaluru/rent-lease/
apartment`, or the PG tab further filtered to one sharing type) still has nothing left to mix
beyond whatever the tab-and-city selection already leaves — this only applies at the tab level
itself, using the DTO's existing `homeCategory`/`cityId` values to pick the right row above.

**Why a compound key, not the tab's own dimension alone**: for PG/Furniture/Interiors specifically
(only one real `ListingCategory` each), the "87 pg listings flooding the PG tab" case isn't a
category problem — it's the same rows showing up as one big undifferentiated wall of "PG" cards
with no variety in *what kind* of PG or *where*. The tab's own facet alone (sharing type) would mix
single/double/triple-sharing together, but 87 single-occupancy listings all in one city would
still look repetitive; city alone would spread listings geographically but could still show 5
single-sharing PGs in a row before a double-sharing one appears. The combination guarantees both
kinds of variety at once, and the same reasoning is exactly why All/Buy/Rent & Lease also fold in
city rather than relying on category alone. **City, not area**: area is a finer grain that
fragments the recent pool into many near-empty buckets (most areas have only a handful of recent
listings), which defeats the point of a round-robin — city is the coarser, more reliably-populated
dimension. Area is worth revisiting later if city alone still reads as repetitive once there's real
volume to look at.

A listing missing its facet value (an older listing posted before the field existed, or just left
blank) groups under its own "unspecified" bucket — it still gets a fair rotation slot, just
alongside other unspecified-facet listings rather than being dropped or crashing the grouping.

### Design: round-robin by the tab's group key, recent window only, first N pages only

Split the feed into two zones instead of one flat order:

- **Zone A — "recent, mixed"**: listings created within the last **3 days** (configurable), ordered
  so that groups (from the table above) interleave instead of clustering. Concretely, rank each
  listing by `ROW_NUMBER() OVER (PARTITION BY <group key> ORDER BY createdAt DESC)` — "this is the
  Nth-newest listing *within its own group*" — then order Zone A by `(that rank ASC, createdAt
  DESC)`. Effect: the very top of the feed is the single newest listing from *every* group that
  has recent activity (one each, newest-first among themselves), then the second-newest from each,
  and so on. A group with 87 recent listings no longer buries everything else — it just supplies
  one slot per round, same as a group with 1.
- **Zone B — "everything else"**: listings older than 3 days (or once Zone A is exhausted),
  ordered exactly as today (`createdAt desc`). No behavior change here — this is the plain,
  honest, unmodified feed once you page past the curated head.
- Boosted listings still sort ahead of both zones, unchanged by this part (see Part 2 for the
  bound on that).

Bounding Zone A to **the first 2 pages** (24 listings at `PAGE_SIZE=12`), for every tab, keeps
this cheap and keeps "later pages are just a plain chronological list" true — a visitor who pages
deep is browsing with intent, not skimming what's new, so there's no real cost to reverting to
plain order there. Page 3+ never runs the round-robin computation at all, in any tab.

### Why not something else

- **A random shuffle within the recent window** would also break up clustering, but breaks stable
  pagination (page 2 can repeat or skip listings between loads unless a seed is fixed per request)
  and gives no guarantee of *representation* — a shuffle of 87 pg + 6 house could still put 8 pg
  listings before the first house one, purely by chance. Round-robin-by-group guarantees
  representation, which is the actual thing being asked for ("a mix").
- **Penalizing by `Listing.source`** (`direct` vs `google_api`, i.e. "is this a bulk import") was
  considered instead of category, as a single blanket fix. It's a reasonable proxy for the *All*
  tab today (scrapes are single-category runs), but the real complaint is about visible
  homogeneity, not *how* a listing was created — an organic wave of postings in one category (no
  bulk import involved) would have the same problem and this framing would miss it. Grouping by
  each tab's own natural key, folding in city when relevant, is the direct fix.

### Implementation sketch

`ListingsService.list()`, when `offset < 2 * limit` (serving one of the first 2 pages) — applies
in every home-tab context, using a group-key extractor chosen from the table above. `cityId` (the
query's own filter, already resolved by the caller before `list()` runs) is folded in only when
absent, per the "all cities vs one city" table above:

```ts
function groupKeyFor(
  tab: HomeCategoryFilter | undefined,
  cityIdFilter: string | undefined,
  listing: Listing,
): string {
  const dimension =
    !tab || tab === 'buy' || tab === 'rentLease'
      ? listing.category
      : String(
          (listing.attributes as Record<string, unknown>)[
            tab === 'pg' ? 'sharingType' : tab === 'furniture' ? 'condition' : 'serviceType'
          ] ?? 'unspecified',
        );
  // Already filtered to one city — every candidate row shares it, so adding it to the key would
  // be a no-op split (one group per value, since there's only one value) rather than a real fix.
  return cityIdFilter ? dimension : `${dimension}::${listing.cityId}`;
}
```

1. Fetch Zone A candidates: `findMany({ where: { ...where, createdAt: { gte: threeDaysAgo } } })`
   — no `ORDER BY` needed from Postgres for this part; pull the whole recent pool for *this tab's*
   `where` (already scoped to the right categories/transactionTypes — bounded to a few hundred rows
   even on a very active day for the widest tabs) and rank in application code: group by
   `groupKeyFor(...)`, sort each group by `createdAt desc`, then round-robin-flatten across groups.
   This avoids a raw `$queryRaw` for the `ROW_NUMBER() OVER (PARTITION BY ...)` — doable in
   Postgres directly, but the row count here is small enough that doing it in JS is simpler and
   just as fast, and keeps this readable/testable (a pure function of a small `groupKeyFor`, easy
   to unit test independent of the DB) without a raw SQL string to maintain.
2. If Zone A has fewer rows than needed to fill the requested page window, top up from Zone B
   (`findMany` with `createdAt: { lt: threeDaysAgo }`, existing `ORDER_BY.newest`, `take: <shortfall>`).
3. Boosted-first ordering is applied to the *combined* Zone A + Zone B result before slicing to
   the requested `offset`/`limit` window, same as today.
4. `total` (for pagination) is unchanged — still a plain `count()` over `where`, since the
   round-robin only reorders, it never changes *which* listings match.

This only touches `ListingsService.list()` and stays behind the existing `ListListingsDto` shape —
no API contract change, `apps/web`'s `page.tsx` needs no changes at all.

## Part 2 — Cap boosted-listing visibility to the first 2 pages — **BUILT**

### What it replaced

`ORDER_BY` used to put boosted listings first, unconditionally: `{ boostRank: { sort: 'desc',
nulls: 'last' } }` ahead of everything else, for every page, with no cap. `BoostRotationService`
reshuffles `boostRank` for all currently-boosted listings every 30 minutes, so *among* boosted
listings the order rotates — nobody permanently squats slot #1 — but there was no limit on *how
many* pages the boosted tier could span. Fine while 0 listings are boosted, but as adoption grows
this could eventually push organic content past page 2, 3, 4+, which cuts against the point of
"first-page visibility" being the thing being sold — if everyone's boosted, nobody is.

### What was built

- `BOOST_FEATURED_SLOTS_PER_PAGE = 4`, `BOOST_FEATURED_CAP = 4 × RECENT_MIX_PAGES = 8` (constants
  next to the recent-mix ones in `listings.service.ts`) — up to 8 boosted listings, the top-N by
  `boostRank`, get a guaranteed "featured" slot at the very front of the first 2 pages.
  **Front-loaded onto page 1 first, not a strict "exactly 4 per page" split** — simpler to
  implement and reason about, and still satisfies "boosted ads show up in the first two pages"
  since 8 always fits inside 2 pages' 24 slots. Worth revisiting for an even split later if page 1
  ends up feeling crowded relative to page 2.
- Listings boosted **beyond** the cap are not hidden or demoted — `fetchOffsetPage` merges them
  back into the recent-mix/older pools (removed the `boostRank: null` exclusion those queries used
  to have, filtering out only the ids that already got a featured slot instead) so they compete
  on their own merits, same as a non-boosted listing of the same age. They still carry the "⭐
  Featured" badge (`ListingCardDto.isBoosted`, driven by `boostedUntil` independent of `boostRank`/
  the cap) — **no residual ranking bump past the cap**. Resolved this way rather than asking
  again, matching the plan's own recommendation: simplest, and avoids a slow creep back toward
  "boost dominates everything" as more listings buy it.
- **Applies to every home tab**, composing with Part 1 exactly as originally planned — the cap is
  evaluated first (fills up to 8 featured slots total), then Part 1's round-robin fills the rest
  from the recent/older pools, using whichever tab's own group key is in scope.
- A no-op today, by construction — 0 listings are boosted, so `featuredRows` is always empty and
  the code path degrades to exactly what Part 1 alone already did.

### Verification

3 new tests in `listings.service.spec.ts` (`ListingsService.list — recent-listings mix`): the cap
holding at exactly 8 when more listings are boosted than that, the overflow (9th/10th boosted)
showing up in the recent pool rather than being dropped, and an overflow listing still reporting
`isBoosted: true` despite missing the guaranteed slot. Full bff suite otherwise unaffected (one
pre-existing, unrelated failure tracked earlier this session, unchanged by this).

## Part 3 — "Auto" sort default, explicit sort bypasses the mix entirely — **BUILT**

Both parts above only make sense under the *default* ordering — a visitor who explicitly asks for
"Price: Low to High" wants exactly that, not a reshuffled version of it. Before this part, the
"Sort by" control's default option was literally called "Newest first" and mapped to `sort=newest`
(or no `sort` param at all), which happened to be the same value the mix logic keyed off of — but
nothing distinguished "no explicit choice was made" from "the visitor explicitly chose the newest
option," so there was no clean place to gate the mix on.

- Added a new **`auto`** wire value as the default, both in the DTO (`SORT_VALUES` in
  `apps/bff/src/listings/dto/list-listings.dto.ts` and `apps/web/src/lib/seoRoute.ts`) and the UI
  (`SortDropdown.tsx`'s `SORT_OPTIONS[0]`, `{value:"auto", label:"Auto"}`) — "Auto" describes what
  it does (recent-mix + boost-cap) in a way "Newest first" never did, since that label promised a
  literal chronological order the mix doesn't give.
- **`newest` stayed a first-class, separately-selectable option** — `SortDropdown.tsx`'s
  `SORT_OPTIONS` keeps `{value:"newest", label:"Newest first"}` right after Auto. First cut of
  this change briefly folded `newest` into an alias for `auto` (reusing the old default's wire
  value rather than adding a new one), on the reasoning that both meant "newest-first" and old
  `?sort=newest` links should keep resolving either way — but that silently took away the one
  option for a visitor who wants literal, un-mixed posting-date order, which is exactly what
  "Newest first" has always promised. Reverted: `newest` now means what it says (see
  `wantsExplicitSort` below), and an old `?sort=newest` link still resolves to a valid sort — its
  literal meaning, not a redefinition to "auto" — which satisfies this repo's URL-stability
  convention without giving up the option.
- New `wantsExplicitSort(sort)` in `listings.service.ts`: true for `newest`/`price_asc`/
  `price_desc`/`popular`, false for `auto`/undefined. `fetchOffsetPage` now takes this as a param
  and short-circuits straight to the plain single-query path (`findMany` with the requested
  `orderBy`, `skip`/`take`) whenever it's true — on *every* page, including page 1, not just
  page 3+.
- **Boosted-first ordering is unaffected by this gate** — it's considered part of "which listings
  are prioritized," not "sort by," so a boosted listing still sorts ahead of the plain-sorted
  results even under an explicit sort (including "Newest first"), uncapped (exactly the
  pre-Part-2 behavior), since `wantsExplicitSort` only decides whether the *recent-mix* pass
  runs, not whether `ORDER_BY` itself still has its boosted-first tier.

### Verification

3 new test blocks in `listings.service.spec.ts`: `sort=newest|price_asc|price_desc|popular` at
`offset:0` each resolve to exactly one plain `findMany` call (`skip:0, take:12`) — the mix's usual
3-call pattern (boosted/recent-pool/older-pool) never fires; `sort` absent or `'auto'` still
triggers the 3-call mix path, unchanged. Full bff suite otherwise unaffected (the one pre-existing,
unrelated failure tracked earlier this session, unchanged by this).

## Verification

- **Part 1**: pick a day with a real skewed bulk-import (like the current 87 pg / 6 house / 5 plot
  / 4 apartment / 1 villa split) and confirm the All tab's all-cities page 1 shows a genuine mix
  both by category and by city, not 12 pg listings — or 12 listings from one city — in a row;
  confirm the same on the Buy and Rent & Lease tabs specifically (category *and* city both mixed);
  confirm the PG tab mixes by sharing-type × city; confirm that once a specific city is selected
  (`?city=` or a `/{city}/...` page), the city component drops out of the key on every tab (no
  wasted grouping by a single-valued dimension) while the tab's own dimension still mixes
  normally; confirm page 3+ is unaffected (still plain `createdAt desc`) in every tab and every
  city selection; confirm a narrower, one-step-past-a-tab view (e.g.
  `/bengaluru/rent-lease/apartment`, or PG filtered to one sharing type) is unaffected, since
  there's nothing left to mix at that depth.
- **Part 2** (once built): seed more boosted listings than the per-page cap in a local/staging
  environment, confirm exactly N show per page for the first 2 pages, confirm page 3+ never shows
  a boosted listing out of its natural sort position, confirm `BoostRotationService`'s existing
  30-minute reshuffle still rotates *which* boosted listings fill the capped slots.

## Critical files

- `apps/bff/src/listings/listings.service.ts` — `list()`, `ORDER_BY`, both parts land here.
- `apps/bff/src/payments/boost-rotation.service.ts` — unchanged by Part 1; Part 2 reads its output
  (`boostRank`) but doesn't need to change the rotation job itself.
- `docs/plans/monetization-boosted-listings-premium-tiers.md` — the doc that already owns the
  boost feature's design; update it once Part 2 actually ships, since it currently documents the
  *uncapped* boosted-first behavior as final.
- No frontend changes for either part — `apps/web/src/app/page.tsx` and `BrowseListingsView`
  already just render whatever order the BFF returns.
