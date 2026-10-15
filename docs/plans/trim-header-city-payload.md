# Trim the city list serialized into every page (15 Oct 2026)

Search-tool audit: 65 pages with a "low text-HTML ratio" (0.01). Measured on production, `/tools` was
about 340 KB of HTML holding 1.9 KB of visible text; about 310 KB was inline `self.__next_f.push`
(RSC flight) data.

## Cause

`Header` passed the full `City[]` (758 rows: id, name, state, lat, lng, two flags) to the client
`SearchBar`. The same element is mounted in three slots (desktop bar, mobile inline search, collapsed
bar), so the list was serialized into the HTML twice, roughly 107 KB each — over 200 KB on every page
that uses the shared header. `SearchBar` only ever read `c.name` (to recognise a city typed into the
query).

## Change

`SearchBar` takes `cityNames: string[]` instead of `allCities: City[]`; `Header` maps to names on the
server. Same matching, same order, no behaviour change. Expect about 200 KB less HTML per page.

## Not changed / expectations

- The audit's ratio will still read low: a Next.js page always carries hydration data. The gain is
  smaller HTML and better load metrics, not a passing audit.
- `LocationPicker` fetches its own city list on demand and `Footer` renders on the server, so
  neither adds to the payload.
- Re-measure after deploy: fetch a page with `Accept-Encoding: identity` and compare the size of the
  `__next_f` scripts (before: about 307 KB on `/tools`).
