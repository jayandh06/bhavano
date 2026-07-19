# Smart search, dynamic popular searches, and city-picker/header bugs

## Context

Five related asks, and investigation turned up a shared root cause behind most of them: the
city-first SEO pages (`/{city}/{transactionGroup}/{category}/{facet}/{locality}`, built earlier
this session) never actually got the site's `<Header>` — no search bar, no city picker, no mega
menu — they only render a plain "Bhavano" text link back to `/`. That's why the search bar feels
disconnected from real browsing, and it's tangled up with why city-switching looks broken. Fixing
that gap is a prerequisite for the "smart search" feature to be usable at all outside the homepage,
so it's folded into this plan rather than treated as a 6th, unrelated item.

Confirmed root causes (all read directly from source, not guesses):

- **Local city-switch bug**: `LocationPicker.selectCity` (`apps/web/src/components/home/LocationPicker.tsx:48`)
  always calls `buildHomeUrl(...)` → `/?city=<id>`. The homepage (`apps/web/src/app/page.tsx:60-63`)
  then resolves that id only against `popularCities` (from `fetchCities()` called with **no**
  args → bff returns popular-only). A tier-2 "more cities" id never matches, so it silently falls
  back to Bengaluru/first popular city — looks exactly like "nothing happened."
- **Header/search missing on city & listing pages**: confirmed via grep — zero references to
  `Header`/`SearchBar`/`CategoryTabs`/`LocationPicker`/`MegaMenu` in `BrowseListingsView.tsx` or
  `ListingDetailView.tsx`.
- **Search bar today**: `SearchBar.tsx` has a hardcoded placeholder and only ever pushes a raw
  `?q=<text>` param, which the bff turns into a bare `title.contains` match
  (`apps/bff/src/listings/listings.service.ts:123`) — no city/area/category/price parsing at all.
- **Footer "Popular searches"**: 4 hardcoded `<Link>`s in `Footer.tsx` — no data behind them.
  There's also no search-query telemetry anywhere to mine (search was never more than a text
  filter), so "popular" has to be derived from real inventory signals that already exist
  (listing counts / `viewCount`), not literal search history.
- **Header "For Owners" / "Help"**: both are bare `<span>`s (`Header.tsx:37-38`) — no `href`, no
  `onClick`. Not a hidden feature, just dead placeholder text. `/help` and `/post` both already
  exist and work elsewhere (Footer, `HeaderAuthButtons`, account menu).
- **Prod missing cities**: `docs/deployment.md` only documents `npx prisma migrate deploy`
  (schema-only). The seed script that actually inserts `City`/`Area` rows
  (`apps/bff/prisma/seed.ts`, run via `prisma db seed` → `tsx prisma/seed.ts` per
  `prisma.config.ts`) has apparently never been run against the EC2/RDS database — `migrate
  deploy` never runs seeds, that's Prisma's own separation of concerns. City/Area upserts are
  idempotent (`upsert` keyed on `name_state`/`name_cityId`) and safe to run repeatedly; the
  listings block (`deleteMany`+`createMany` scoped to a fixed "Seed Owner" phone) is demo data,
  confirmed **not** safe to run against a live production database as-is.

**Decisions from the user:**
- Split `seed.ts` so only cities/areas run in prod — demo listings stay dev/local-only.
- Header's "For Owners" links to `/post` (reuses the existing post flow, no new page).

## 1. Render `<Header>` on city browse & listing-detail pages

`apps/web/src/app/[city]/[[...rest]]/page.tsx` already resolves `cityRow` (via `resolveCity`) and
`session` (via `auth()`) before rendering either branch. Pass these through to
`BrowseListingsView`/`ListingDetailView` so both can render the same `<Header>` the homepage uses:
- `cityName` → `cityRow.name`
- `popularCities` → needs fetching (`fetchCities()`, same as homepage) — thread through as a prop
- `searchQuery` → `""` (no free-text query is ever active on these path-driven routes)
- `activeCategory` → best-effort `HomeCategoryFilter` derived from `parsed.transactionGroup`/`category`
  for tab-highlighting/mega-menu purposes (a small mapping function, same idea as
  `buildQueryForSegments` in `seoRoute.ts` already does for the reverse direction)
- `userName` → `session?.user?.name`

This is additive (new props, existing component reused as-is) — no changes to `Header.tsx` itself
needed for this part.

## 2. Fix the city-picker to use city-first paths

`LocationPicker.selectCity` (and the auto-detect flow, which also calls `selectCity`) should
navigate to a real city-first path instead of `/?city=<id>`, using `buildBrowsePath` from
`apps/web/src/lib/listingPath.ts` (already builds `/{city}/{group}/{category}/{facet}/{area}` from
parts — exactly what's needed here, no new URL-building logic required).

- `LocationPicker` needs to know what part of the current browse context to preserve. Add an
  optional `currentSegments` prop (the already-parsed `ParsedSegments` from `seoRoute.ts`, passed
  down from `[city]/[[...rest]]/page.tsx` the same way it's used for breadcrumbs/JSON-LD) — when
  present, swap only the city and rebuild via `buildBrowsePath({ cityName: newCity.name,
  transactionGroup: currentSegments.transactionGroup, category: currentSegments.category,
  facetValue: currentSegments.facetValue })` (drop `areaSlug`/`listingSlugId` — a locality/listing
  from the old city obviously doesn't carry over).
- On the homepage (no path segments to preserve), fall back to today's `?city=<id>` query-param
  behavior — that part of `page.tsx` already works correctly for popular cities; the bug was
  specifically that this was the *only* path, applied even when the picker was reached from a
  city-scoped page and even needed for non-popular cities.
- This still leaves the homepage's own bug (non-popular city ids not resolving) — fix `page.tsx`
  to call `fetchCities(undefined, true)` (the existing `all=true` mode, already used by
  `listAllCitiesAction`) instead of the bare `fetchCities()`, so `resolvedCity` can find any city,
  not just the popular ones.

## 3. Smart search bar

**Dynamic placeholder**: thread `cityName` (and, ideally, one representative area name — reuse
`fetchAreas`/`resolveArea` machinery already in `browseRoute.ts`, resolved server-side where
`Header` is rendered and passed down) into `SearchBar`, and interpolate it into the placeholder,
e.g. `Search "2BHK in {areaName}, {cityName}"…`, falling back to today's generic copy if no area
is available yet.

**Query parsing → redirect to canonical URL**: new `apps/web/src/lib/parseSearchQuery.ts` (plain
functions, client-safe like `seoRoute.ts` — no server-only imports), doing rule-based (not NLP)
extraction from the raw input:
- **Category**: match against `CATEGORY_LABELS` (`seoRoute.ts`) plus a small synonyms list
  ("flat"/"apartment", "sofa"/"furniture", "hostel"/"pg", "desk"/"coworking", etc.)
- **Transaction intent**: keyword match → `TransactionGroup` ("for sale"/"buy"/"purchase" → `buy`,
  "for rent"/"rent"/"lease" → `rent-lease`)
- **Bedrooms**: regex similar in spirit to the existing `BEDROOM_SLUG_RE` in `seoRoute.ts`
  (`/(\d)\s*[- ]?\s*bhk|bed(room)?s?/i`)
- **Price bound**: new lightweight parser — numbers with `k`/`lakh`/`lac`/`cr`/`crore` suffixes,
  plus comparison words ("under"/"below"/"<=" → maxPrice, "above"/"over"/">=" → minPrice, a bare
  "X" with no direction defaults to maxPrice, matching how a shopper types "furniture under 5000")
- **City**: match against the `popularCities` list already available in `Header`/`LocationPicker`
  props; falls back to the currently-resolved city (from item 1/2's context) if none is named
- **Area**: best-effort substring match against the resolved city's areas, via a new server action
  mirroring the existing `searchCitiesAction` pattern (`apps/web/src/app/actions/locations.ts`),
  calling `fetchAreas`/`searchAreas`

On submit, `SearchBar` builds `buildBrowsePath({ cityName, transactionGroup, category, facetValue,
areaName }) + "?" + (minPrice/maxPrice as query params, matching how BrowseListingsView/
BrowseFilterBar already layer price filters on top of the path)`, and `router.push`es there. If
nothing structured is recognized at all, fall back to exactly today's behavior (`?q=<raw text>` on
the current city context) so plain-text search never regresses.

This is explicitly a rule-based parser scoped to the phrasings in the request (city name; area in a
city; "apartment for sale in {city}"; "furniture for sale in {city} under {amount}") — not a general
NLP solution.

## 4. Dynamic "Popular searches" (Footer)

New bff aggregation endpoint (e.g. `GET /listings/popular-searches` on `ListingsController`, logic
in `ListingsService`) grouping active listings by `(category, transactionType, cityId)` and
ordering by count (or summed `viewCount`, which already exists on listings from the earlier
cascade-delete work — arguably a better "actually looked at" signal than raw inventory count).
Returns top 4-6 combos with city name/category/transactionType/count.

Web side: `fetchPopularSearches()` in `bff.ts`; `Footer` becomes an async Server Component (trivial
— it currently takes no props/data at all) that calls it and builds each result into a
`buildBrowsePath(...)` link with a label built the same way `buildHeading` composes
`CATEGORY_LABELS`/`TRANSACTION_LABELS`. Falls back to a couple of static combos only if the query
returns nothing (e.g. an empty dev DB), so the footer section is never blank.

Bundled cleanup (same dead-link pattern, same file): wire Footer's "Post a free ad" (currently
`href="#"`) to `/post`; either drop "About" or point it at `/help` until a real About page exists.

## 5. Header "For Owners" / "Help"

Turn both `<span>`s in `Header.tsx` into `Link`s: "Help" → `/help`, "For Owners" → `/post`.

## 6. Prod city/area data

Split `apps/bff/prisma/seed.ts`:
- New `apps/bff/prisma/seedCities.ts` exporting a `seedCities()` function — just the
  `cities`/`areasByCity` upsert loop (lines ~481-502 today), safe to run repeatedly anywhere.
- `seed.ts` imports and calls `seedCities()` first, then proceeds with the demo "Seed Owner"
  listings exactly as today — local `pnpm prisma:seed` behavior is unchanged.
- New `apps/bff/package.json` script: `"prisma:seed:cities": "tsx prisma/seedCities.ts"`.
- `docs/deployment.md`: document running
  `docker compose -f docker-compose.prod.yml exec bff npx tsx prisma/seedCities.ts` once after the
  first `migrate deploy`, and again after any future city/area list edits (this is exactly what's
  needed right now to bring prod's tier-2 cities in sync with local).

## Verification

- `pnpm typecheck` across all packages.
- Local: open the city picker from the homepage, pick a "more cities" (tier-2) entry — confirm it
  actually switches. Repeat from a `/{city}/...` browse page once Header is wired there, confirm
  it lands on the equivalent page for the new city.
- Local: confirm `SearchBar`/`LocationPicker`/`CategoryTabs`/`MegaMenu` all render and work on a
  city browse page and a listing detail page (currently absent).
- Local: exercise each example phrasing from the request through the search bar — a bare city name,
  "{area} {city}", "apartment for sale in {city}", "furniture for sale in {city} under {amount}" —
  confirm each redirects to the expected canonical URL with the right filters applied.
- Local: confirm Footer's "Popular searches" reflects real aggregated data (spot-check the numbers
  against a manual count), and that "For Owners"/"Help" navigate correctly.
- Run `prisma:seed:cities` against the local DB twice in a row to confirm idempotency (no
  duplicate-key errors, no data loss) before recommending it for prod.
