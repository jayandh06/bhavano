# All-cities footer links on every page

## Context

Prior to this change, `Footer` had a single location block that switched modes: the homepage and
static/account pages showed a full "Browse Cities" list, while `/{city}/...` browse pages showed
only that city's own "Areas in {City}" list — never a link to any *other* city.

## Why that was suboptimal for SEO

Every city page's only inbound internal link was from the homepage. That makes each city hub page
an internal-linking "island": Google can still find `/mumbai` (linked from Home), but `/bengaluru`
passed it zero link equity, and there was no sitewide reinforcement — unlike large real-estate/
classifieds sites (99acres, MagicBricks, Zillow), which universally keep a persistent city-list
footer on every page, not just the homepage.

## Decision

`Footer` now renders **both** blocks on a `/{city}/...` page: the existing "Areas in {City}" list
(primary — more topically relevant to someone already browsing that city, and the main link source
area pages have) **plus** a "Browse Cities" list of every other city (secondary — reinforces link
equity to every city hub page from every page site-wide, not just Home). The current city is
excluded from its own "Browse Cities" list (a self-link there is a no-op nobody has reason to
follow). The homepage and static/account pages are unaffected — they only ever had the one
all-cities block, which stays as-is.

Link-count check: ~37 cities + up to 24 areas ≈ 60 footer links max on a city page — well under any
real Google soft-limit on footer link count.

## Implementation

- `Footer.tsx`: extracted a `LocationBlock` sub-component (heading + column-chunked links),
  rendered twice on city pages (areas, then cities-minus-current) instead of one block that
  switched between the two.
- `BrowseListingsView.tsx` gained an `allCities: City[]` prop, passed through to `Footer` — reuses
  the `allCities` the `[city]/[[...rest]]/page.tsx` route already fetches for `popularCities`,
  rather than Footer fetching it again.
- `[city]/[[...rest]]/page.tsx`: passes its existing `allCities` into `<BrowseListingsView>`.

## Verification

- `/bengaluru` footer shows both "Areas in Bengaluru" and "Browse Cities" headings.
- "Browse Cities" on `/bengaluru` links to `/mumbai`, `/pune`, etc., and does **not** link back to
  `/bengaluru` itself (confirmed no self-link in the footer — the one `/bengaluru` href on the page
  is the pagination control's "page 1" link, unrelated).
- Homepage footer unchanged — still shows only "Browse Cities".
- `pnpm typecheck` (web) clean.
