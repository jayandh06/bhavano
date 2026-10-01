# Featured (boosted) listings: more homepage visibility

## Status: #1/#2/#5 implemented 2026-10-01 (not yet deployed); #4 not started, needs pricing input

## Request

"Can we do something different for Featured ads such that they get more visibility on the home
page" — five directions were sketched, grounded in how `isBoosted`/boost actually works (one flat
purchasable product differentiated only by duration, no separate "strength" tier; the homepage's
only existing featured treatment was a small badge plus a shot at the shared featured-cap slots in
`docs/plans/homepage-category-mix-and-boost-page-cap.md`). This doc covers what was actually built
from that list — see that other doc for the cap/round-robin mechanics these build on top of.

## What shipped

### #1 — scale the featured cap to adoption

Already written up in `docs/plans/homepage-category-mix-and-boost-page-cap.md`'s own Part 2 update
(2026-10-01) — the flat 8-slot cap became `Math.floor(windowSize * 0.5)` (12 at the homepage's
`limit:12`), so boost demand isn't held at a number chosen before there was any real adoption to
size it against.

### #2 — per-category featured slots

Already shipped and documented in the same doc, earlier the same day — `roundRobinByGroup` applied
to the boosted pool before slicing to the cap, so one boost-heavy category can't take every slot.
Listed here only for completeness against the original five suggestions.

### #3 — a dedicated Featured rail

New BFF capability: `ListListingsDto.featuredOnly` (boolean query param on the existing
`GET /listings`). When set, `ListingsService.list()` short-circuits before offset/cursor mode
entirely — one `findMany` for every current match with `boostRank` not null (same `where` the rest
of the query would have built, so it respects `homeCategory`/`cityId`/etc.), round-robin'd by
`recentMixGroupKey` (the same fairness the main feed's featured cap gets — one boost-heavy category
can't fill the whole rail either), sliced to `limit`. No pagination: the rail always asks for the
first `limit` from a fresh top, since there's no "page 2" of a rail. `total` reports how many
boosted matches exist in total (not just how many fit in `limit`), in case that's ever useful to
show ("12 more featured listings").

Web: `FeaturedRail.tsx` (new) — a horizontal, `overflow-x-auto` + `scroll-snap` strip of
`ListingCard`s at a fixed ~260–290px width, no carousel library or client state (dragging/swiping a
native-scrolling row needs none). Renders nothing when `items` is empty, so an empty rail never
reserves visible space.

Wired into the homepage (`apps/web/src/app/page.tsx`) only: page 1, only without an active text
search (`!q`) — a rail of promoted listings above someone's own search results would read as noise,
backwards from what search is for — scoped to the same `homeCategory`/`cityId` the main feed
already uses, so "Featured" means featured *for this tab/city*, not an unrelated sitewide sample.
Fetched as a second, independent `fetchListings({ featuredOnly: true, limit: 10, ... })` call
alongside the existing one. Not wired into `BrowseListingsView.tsx` (the SEO city/category pages)
or mobile in this pass — both are reasonable follow-ups, deliberately left out to keep this change
reviewable.

### #5 — a louder card treatment

`ListingCard.tsx`'s root card div: a boosted listing now gets a `border-gold/70` 1.5px border and a
soft gold-tinted resting shadow (`shadow-[0_2px_10px_rgba(201,161,90,0.22)]`), intensifying to a
solid gold border on hover — instead of the same flat `border-border/70` every other card gets,
with gold only ever appearing in the small badge. The badge alone was easy to miss in a dense grid;
this carries the same signal across the whole card, visible even before a visitor's eye reaches the
badge text itself.

### #4 — two-tier boost (not built — needs your input)

The original suggestion: a pricier "Premium" tier that gets the homepage-wide featured slot (what
today's single boost product already does), and a cheaper base tier that only gets bumped within
its own category/city page — creating real scarcity at the top as adoption grows, instead of #1's
fix (which keeps diluting what "featured" means as more people buy the one existing product).

Not started, and deliberately not attempted without checking first — this touches real pricing
(`BoostPriceSetting`, currently one flat price per category per duration) and the purchase/checkout
flow (`BoostPlanSelector.tsx` in both web and mobile, Razorpay checkout) in a way the other four
items don't: it needs actual price points for a new tier, not just an engineering judgment call.
Needed before this can start:

- What should "Premium" cost relative to the existing boost price, per category tier (property /
  coworking-PG-storage / furniture-interiors)? A flat multiplier (e.g. 2×) or new absolute prices?
- Does "Premium" replace the existing product name/durations, or sit alongside it as a 4th/5th
  price point per category?
- Should an existing boosted listing be offered an upgrade path, or does this only apply to new
  purchases going forward?

## Not done in this pass

- Mobile: no equivalent Featured rail — `BoostPlanSelector.tsx` (the purchase UI) is unaffected by
  any of this; the *display* side of boost on mobile's home screen wasn't touched.
- `BrowseListingsView.tsx` (the SEO city/category browse pages) has no Featured rail — only the
  homepage (`apps/web/src/app/page.tsx`) does.
- No admin visibility into rail performance (impressions/clicks on rail slots specifically, as
  distinct from the existing `BoostEffectivenessStat` nightly job).

## Critical files

- `apps/bff/src/listings/dto/list-listings.dto.ts` — `featuredOnly`.
- `apps/bff/src/listings/listings.service.ts` — the `featuredOnly` short-circuit branch in `list()`;
  `BOOST_FEATURED_CAP_MAX_FRACTION` (cap scaling, documented in the other plan doc).
- `apps/web/src/lib/bff.ts` — `ListingsQuery.featuredOnly`, `fetchListings`.
- `apps/web/src/components/home/FeaturedRail.tsx` (new).
- `apps/web/src/app/page.tsx` — the second `fetchListings` call, `<FeaturedRail>` placement.
- `apps/web/src/components/home/ListingCard.tsx` — the boosted-card border/shadow treatment.

## Verification

- BFF: new test for `featuredOnly` (one `findMany` call, round-robin'd result, `nextCursor: null`,
  `total` reporting every boosted match not just what fit in `limit`) — `listings.service.spec.ts`.
  Full suite: 695 passing (one pre-existing, unrelated jwks-rsa/ESM failure tracked earlier this
  session, unchanged).
- Web: `tsc --noEmit` and eslint clean on every touched file.
- **Not verified**: a live look at the rendered rail in a browser. No local BFF/database was
  running in this environment (same gap noted for the mandatory-description e2e specs earlier the
  same day) — worth a real look (scroll behavior, card width at phone size, the gold border against
  both light/dark themes) before calling this done.
