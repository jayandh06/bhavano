# SEO-friendly city/area discovery: footer city+area links, and a real "Popular/Try Searching" section

## Context

Two related gaps in how Bhavano surfaces internal links today:

1. **`Footer.tsx`** (`apps/web/src/components/home/Footer.tsx`) renders on every page, but its
   location links are weak: a hardcoded "Categories" section that always points at
   Bengaluru/Mumbai regardless of what city is actually being browsed. Consequence: most of the 37
   seeded cities have **no on-page link to them anywhere** (`MegaMenu` only builds links for
   whichever city is already selected; `LocationPicker` is a client-side switcher, not crawlable
   `<a>`s), and **areas** (Koramangala, Indiranagar, …) have no dedicated link to them at all, at
   any zoom level. `sitemap.ts` only lists a city/area once it already has a listing, so a
   zero-listing city/area is invisible to crawlers today except by guessing the URL.

2. **"Popular searches"** (currently a footer section, real data from `fetchPopularSearches()`)
   and **`SearchBar`'s own "TRY SEARCHING" chips** (`apps/web/src/components/home/SearchBar.tsx`
   lines 181–193) are both about surfacing example searches — but the chips are `onClick` buttons
   that call `submitChip()`, not real `<a href>`s, and only render once the search box is focused
   (`open && ...`), so they don't exist in the server-rendered HTML at all until a user interacts —
   zero crawl value today. Moving "Popular searches" out of the footer (bottom of page, less
   prominent) into a real, always-rendered, high-up section — alongside a **new, genuinely
   crawlable** version of "try searching" (real `<Link>`s built via `buildBrowsePath`, not
   `onClick` text-fill) — is strictly better for both users (more prominent) and SEO (real anchor
   links, higher up the page, always in the initial HTML).

`SearchBar`'s own internal focus-triggered dropdown (its "TRY SEARCHING" chips, used for live query
interpretation while typing) is **left as-is** — it's a distinct, JS-driven typing aid, not what's
being relocated.

## Design

### 1. Footer: city/area links replace the hardcoded "Categories" section

- **No specific city in context** (homepage, static pages, account pages) → **"Popular Cities" +
  "More Cities"**, split on the existing `City.isPopular` flag (12 popular / 25 more — mirrors
  `LocationPicker`'s own popular/tier-2 split). Every city gets a real link
  (`buildBrowsePath({ cityName })`).
- **A specific city is in context** (any `/{city}/...` browse page) → **"Areas in {City}"**, every
  area of that city (`buildBrowsePath({ cityName, areaName })`), capped at a fixed constant (e.g.
  24 — today's largest city has 20 curated areas, so this is a defensive ceiling, not an active
  truncation).
- The footer's grid is already `[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]`
  (auto-fit, wraps), so 5→6 columns in "all cities" mode needs no layout rework.
- `Footer()` becomes `Footer({ currentCityName, cityAreas, allCities }: { currentCityName?:
  string; cityAreas?: Area[]; allCities?: City[] })`, all optional. If `allCities` isn't passed,
  `Footer` fetches it itself (`fetchCities(undefined, true)`) — every existing bare `<Footer />`
  call site (static/account pages) keeps working unchanged and picks up "Popular/More Cities" for
  free, not just the homepage.
- Two call sites already have the data in scope and just thread it through:
  - `apps/web/src/app/page.tsx` — `allCities` already fetched at line 67; pass into `<Footer />`.
  - `apps/web/src/components/home/BrowseListingsView.tsx` — already has `cityName`/`cityAreas` as
    its own props; pass `currentCityName`/`cityAreas` into its own `<Footer />` call.
- `ListingDetailView.tsx` doesn't render `<Footer />` today — left out of scope, not touched.
- The "Popular searches" section is **removed** from `Footer.tsx` (moves per part 2 below).
  "Company"/"Legal" sections are untouched.

### 2. New `SearchSuggestions` section, rendered once, directly below the search bar

New component, e.g. `apps/web/src/components/home/SearchSuggestions.tsx` (server component):

- **"Popular Searches"** — the exact data/links `Footer` used to render (`fetchPopularSearches()`,
  same `FALLBACK_SEARCHES` fallback, same anchor style). Stays **global** (not city-scoped) — the
  BFF's `getPopularSearches()` (`apps/bff/src/listings/listings.service.ts` line 383) has no
  per-city filter today, and adding one is backend scope beyond this UI move; worth a future
  follow-up now that this section lives somewhere city-aware.
- **"Try Searching"** — a new, genuinely crawlable version of `SearchBar`'s example-chip idea:
  real `<Link>`s (not `onClick`) built with `buildBrowsePath`, using the same descriptive-anchor
  convention already established in `homeCategories.ts`/`MegaMenu`, e.g. "2 BHK Apartments in
  {cityName}", "PG in {cityName}", "Coworking in {cityName}", "Furniture in {cityName}" — scoped to
  whichever city the page is already showing (`cityName` is available at every call site).
- Rendered as the first child of `<main>`, right after `<Header>` closes — i.e. immediately below
  the search bar — in:
  - `apps/web/src/app/page.tsx` (homepage)
  - `apps/web/src/components/home/BrowseListingsView.tsx` (SEO browse pages)
  - Not in `ListingDetailView.tsx` (mid-listing-detail isn't the place for search prompts) — same
    scope boundary as the footer change.

## Files

- **`apps/web/src/components/home/Footer.tsx`** — remove "Popular searches"; replace "Categories"
  with the two-mode city/area section; new optional props.
- **`apps/web/src/components/home/SearchSuggestions.tsx`** (new) — "Popular Searches" + "Try
  Searching", both real links.
- **`apps/web/src/app/page.tsx`** — pass `allCities` into `<Footer />`; render
  `<SearchSuggestions>` at the top of `<main>`.
- **`apps/web/src/components/home/BrowseListingsView.tsx`** — pass `currentCityName`/`cityAreas`
  into `<Footer />`; render `<SearchSuggestions>` at the top of `<main>`.

No BFF/DTO/Prisma changes — pure presentation over data every relevant page already fetches
(`City[]`, `Area[]`, `fetchPopularSearches()`).

## Verification

- `pnpm --filter @bhavano/web typecheck`
- Browser check (dev servers already running):
  - Homepage: a "Popular Searches"/"Try Searching" block appears right below the search bar (real
    links, visible in page source without focusing anything); footer shows "Popular
    Cities"/"More Cities" with 12/25 real links.
  - `/bengaluru/buy/apartment`: same suggestions block (city-scoped "Try Searching" links); footer
    shows "Areas in Bengaluru" with real area links.
  - `/privacy` (static page): footer still shows a sensible "Popular/More Cities" fallback (proving
    the no-args-passed path works).
