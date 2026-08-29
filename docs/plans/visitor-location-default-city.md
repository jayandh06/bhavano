# Defaulting to the visitor's own city, not Bengaluru

## The problem

Someone in Chennai opens bhavano.com and sees Bengaluru. So does someone in Hyderabad, Pune, or
Coimbatore. The default is hardcoded in two places:

| Where | Line |
|---|---|
| `apps/web/src/app/page.tsx` | `popularCities.find((c) => c.name === "Bengaluru")` |
| `apps/web/src/components/home/PageHeader.tsx` | same expression, for the "Showing ads near" chip |

(`app/not-found.tsx` also names Bengaluru, but as static example links on a 404 — leave it.)

For a classifieds marketplace this is the worst possible first impression: every listing on screen
is in the wrong city, and the visitor has to work out that the small chip near the logo is what
fixes it.

## What already exists

The hard half is built. `LocationPicker` has a "Use my current location" button that calls
`autoDetectCityAction` → the BFF's `GET /locations/reverse`, which haversine-scans `City.lat/lng`
and returns the nearest. It works.

What is missing is knowing where someone is **without asking them**. Today that path only runs on
a deliberate click, behind a browser permission prompt.

There is also no memory: a Chennai visitor who picks Chennai is back on Bengaluru next visit.

## The target precedence

```
?city=<slug> in the URL      explicit, always wins
bhavano_city cookie          what they chose last time
IP → nearest city            first-ever visit
Bengaluru                    everything else
```

Each step only runs if the one above produced nothing.

---

## Step 1 — Remember the chosen city (ship this on its own) — **DONE**

Implemented as described below: `middleware.ts` writes `bhavano_city`, `lib/defaultCity.ts`
reads and validates it, and both hardcoded "Bengaluru" fallbacks now go through it. Step 2 is
still open.


No guessing, no new dependency, no privacy question, and it removes most of the annoyance.

A `bhavano_city` cookie holding the city **slug** (never the id — see the URL consistency section
of `.claude/CLAUDE.md`; a cuid is invalidated by a reseed, a slug is not). 90 days, `httpOnly`,
`sameSite: lax`.

**Where it gets written matters.** A Server Component cannot set a cookie during render, so
`page.tsx` cannot do it. `middleware.ts` already runs on every page navigation and already writes
`bhavano_acq` and `bhavano_sid`, so it is the natural home: it can read the resolved city from
either `?city=<slug>` or the first path segment of a `/{city}/...` URL and write the cookie.

One caution: middleware currently early-returns when both its cookies exist. City capture has to
sit before that return without making the common path expensive — it is string work on
`nextUrl`, no I/O, so this is cheap, but the early return needs restructuring rather than
deleting.

Then `page.tsx` and `PageHeader.tsx` read the cookie as the fallback ahead of Bengaluru.

**Validate the cookie against the city list before trusting it.** It is user-controllable input,
and a stale slug from a renamed city must fall through to the next step rather than resolving to
nothing.

## Step 2 — IP → city for first-time visitors — **DONE (needs a licence key to switch on)**

Built as described below, and inert until configured. `GeoIpService` reads `GEOIP_DB_PATH`; with
no database present every lookup returns null and the default city is used, so deploying this
changes nothing until `MAXMIND_LICENSE_KEY` is in `.env` and `scripts/update-geolite.sh` has run.

The `Visit` table also now records the visitor's IP (`20260829120000_visit_ip`), and `/privacy`
discloses both that and the city cookie.


### The obstacle

`www.bhavano.com` is served by Caddy directly on EC2:

```
Via: 1.1 Caddy
X-Powered-By: Next.js
```

No Cloudflare proxy on the apex/www (it fronts `cdn.bhavano.com` only), so there is no
`CF-IPCountry` / `CF-IPCity` header. Nothing currently tells the server where a visitor is.

### Approach: MaxMind GeoLite2, self-hosted in the BFF

- **No per-request external call.** An IP-geolocation API on the first render of every new
  visitor adds latency to the exact page we most want fast, and introduces a third party that can
  rate-limit or go down.
- **Reuses the working half.** GeoLite2 gives lat/lng; that feeds the existing haversine
  `reverseGeocode`. One matching path, not two.
- **Free**, but needs a MaxMind account and a license key to download, and the licence expects the
  database to be refreshed periodically. That is a real operational commitment — a cron or a
  build-time fetch, plus a ~60MB file in the BFF image.

Alternative if that overhead is unwanted: put Cloudflare in front of `www` and read its geo
headers. Cheaper to run, but it is a DNS/proxy change affecting every request to the site, and
city-level accuracy depends on plan. Worth pricing before dismissing.

### Work

1. `maxmind` npm package in the BFF, database path from env, loaded once at boot (not per
   request).
2. `GET /locations/by-ip?ip=<addr>` → the same `CityDto` the existing reverse lookup returns.
3. The web app reads the client IP from `x-forwarded-for` (Caddy sets it) and calls that endpoint
   in the homepage's existing city resolution.
4. **Add a distance cap to the lookup used here.** `reverseGeocode` currently returns the nearest
   city unconditionally — with no cap, a visitor from Singapore or an unmappable IP gets whichever
   Indian city happens to be closest, presented as if it were theirs. Beyond ~150km, return null
   and let the chain fall through to Bengaluru.

---

## SEO — read before building

`.claude/CLAUDE.md` requires flagging this, and it is the part most likely to cause damage.

- **Never redirect `/` to `/chennai`.** Googlebot crawls predominantly from US IPs; a geo-redirect
  on the homepage sends the crawler somewhere arbitrary and breaks every ad landing page. The URL
  must stay `/`.
- **Varying the content of `/` is acceptable.** It is already dynamic (`ƒ /` in the build output),
  already canonicalises to `/` via `alternates: { canonical: "/" }`, and the pages that actually
  rank are the `/{city}/...` routes — which this does not touch at all.
- **Do not geo-vary the `/{city}/...` pages.** They exist to rank per city. Their content must be
  determined by the URL alone, for every visitor and every crawler.
- **This forecloses caching `/`.** Geo-varying content on a cacheable URL means either serving one
  visitor's city to everyone or a `Vary` scheme that defeats the cache. Fine today because the
  homepage is server-rendered per request — but it becomes a constraint worth remembering.

## Accuracy, and why the chip must stay obvious

Indian mobile carriers route large regions through a few peering cities. A Jio user in Coimbatore
can resolve to Chennai or Mumbai. IP geolocation here will be **right more often than a fixed
Bengaluru default, and still wrong a fair amount**.

So this is a better guess, not a correct answer:

- The city chip stays visible and obviously clickable — no auto-locating into a state the user
  cannot see or undo.
- A wrong guess must cost one click to fix, and Step 1's cookie means it is fixed permanently.

## Privacy

Deriving coarse location from an IP address is processing personal data under the DPDP Act. It is
ordinary and defensible for showing local listings, but `/privacy` currently does not mention it.
Add a line before shipping Step 2. Step 1 needs nothing — the user told us their city.

## Out of scope

- **Area-level defaulting.** City is the useful granularity; guessing a locality is both less
  accurate and more obviously wrong when it misses.
- **The mobile app.** It has real GPS and its own permission flow — a much better signal than IP,
  and a separate piece of work.
- **Currency/language.** Single market, single language.

## Suggested order

1. Step 1 alone, deployed and observed. Small, correct, no dependencies. It may resolve enough of
   the complaint that Step 2 becomes optional.
2. Decide MaxMind vs Cloudflare on cost and operational appetite, not on code.
3. Step 2 behind a flag, with the distance cap, and check what it actually returns for a sample
   of real Indian IPs before trusting it.

## Verification

- `?city=` still wins over everything — a shared `/?city=chennai` link must not be overridden by a
  Bengaluru visitor's own cookie or IP.
- A fresh browser (no cookies) from a Chennai IP lands on Chennai.
- Googlebot's US IP lands on Bengaluru and gets no redirect.
- `/{city}/...` pages render identically regardless of visitor IP.
- A cookie naming a city that no longer exists falls through cleanly instead of erroring.
