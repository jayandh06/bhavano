# Analytics: bot filtering, page-view integrity, and attribution writes

All of this landed on 2026-09-16, in response to two questions that turned out to share a cause:
*"why is a logged-in user missing from Page visits?"* and *"why are there individual rows from one
IP instead of one session?"*

## Context

The admin **Page visits** screen reads `Visit` (one row per browser session, keyed by the
`bhavano_sid` cookie) and `PageView` (one row per navigation, same key). It exists to audit Google
Ads spend and read user journeys. That purpose sets the bar: good enough to decide where to spend
money, **not** fraud prevention or access control. Nothing in this document decides what a visitor
sees or is allowed to do.

Three separate problems were found, each hiding the next.

---

## Part 1 — Crawlers were 99.85% of all sessions (implemented)

**The measurement.** 165,202 of 165,450 `Visit` rows had one page view or fewer. Seven sibling
PetalBot IPs in `114.119.128.0/18` contributed ~1,000 sessions each across ~950 distinct landing
paths. By country: 65,552 US, 58,414 unresolved, 10,089 Singapore — against 6,869 India.

**Why it happened.** Crawlers discard cookies. Every request therefore arrives with no
`bhavano_sid`, and the middleware correctly writes a brand-new session for it — one `Visit` row per
request, forever. That is cookie-based grouping working exactly as designed on a client that throws
the cookie away.

**Rejected: grouping by IP.** On Indian mobile carriers, CGNAT puts thousands of unrelated real
people behind one address. Grouping analytics by IP would merge strangers into one "session", which
is worse than the problem it solves. The only real fix is not counting them.

**Implemented.** `packages/types/src/botUserAgent.ts` — `isBotUserAgent()`, a substring match over
~40 lowercased patterns, registered in the package's `exports` map and shared by both sides so they
cannot disagree:

- `apps/web/src/middleware.ts` drops known crawlers before any cookie is set or anything logged.
- `apps/bff` classifies whatever still arrives onto `Visit.isBot`.

`Visit.isBot` is **nullable and null means *unclassified*, not human.** Every row written before the
column existed has no stored User-Agent to judge after the fact, and ~99.85% of that history is
crawler traffic, so defaulting it to `false` would relabel a bot log as a human one. The admin
Traffic filter therefore treats "humans" as *classified as not-a-bot* (`isBot: false`, never "not
true"), and offers `unclassified` as a first-class option for the history.

**Caveats, recorded deliberately:**

- **`isBot: true` is close to unreachable.** Both sides call the *same* function, so anything the
  middleware catches never reaches the BFF, and anything it misses the BFF misses too. The column
  earns its place as a safety net if the two ever diverge, or for a direct call to the public
  endpoint — not as a population you can query.
- **Consequence: no crawl visibility at all.** Known crawlers are now dropped silently with no
  counter anywhere, and Caddy access logging is off, so nothing records that Googlebot visited.
  That has real SEO value ("is Googlebot indexing the new city/area pages?"). The alternative —
  log crawlers but *flag* them, letting the filter hide them — was offered and not taken. Revisit
  if that question ever needs answering.
- **Adding a pattern**: edit the array, run `pnpm --filter @bhavano/types build` (the `dist/` is
  committed, and skipping the build is the silent failure mode), then deploy **web and bff
  together** — if only one ships, the lists diverge.
- The raw User-Agent is never stored, so a crawler this list misses cannot be found by querying
  later. Identification is currently manual: single-page sessions sharing an IP block, then
  `dig -x`.

---

## Part 2 — Next 16 silently disabled the prefetch guard (implemented)

**The symptom.** After Part 1, sessions were still recording hundreds of page views: 2,327 of 2,716
logged views (86%) arrived under 250ms after the previous view in the same session, each path was
logged 3.51 times on average (worst: 42), and one session was credited with 656 views across 161
paths. The paths were exactly *"every link on the page"* — the nav's `/post`, `/messages`,
`/favourites` plus the visible listing cards, in one sub-second burst, repeated.

**The discovery.** `middleware.ts` had guarded against this since `2850ed8` by checking
`next-router-prefetch`. That check has been **inert since the Next 16 upgrade**: Next strips its own
routing headers before invoking middleware (now "proxy"). Verified by logging every
`next-*`/`rsc`/`sec-*` header the middleware actually receives while explicitly sending
`Next-Router-Prefetch: 1` and `RSC: 1` — both arrive as `null`, and the only one that survives is
`sec-fetch-dest`.

So the bursts were **Next's own `<Link>` prefetching all along**, which also explains the cookie
persistence (it is the real visitor's browser) and the repeats. An earlier hypothesis about a
third-party link-walker was wrong.

**Implemented — stop asking *who* sent the request, ask *what kind* it is.** `Sec-Fetch-Dest` is a
browser-set header, so unlike Next's it survives:

| value | treatment |
|---|---|
| `document` | a genuine top-level page load — counted |
| header absent | a client too old or plain to send it — counted, so real traffic isn't silently lost |
| anything else | `empty` (every RSC request), `iframe`, `embed` — not a person opening a page |

The `Sec-Purpose` check was also widened to catch `prerender`, which contains no "prefetch"
substring and, unlike a prefetch, *would* have passed the new gate as a genuine document load.

The `next-router-prefetch` check is kept — one header read, and it resumes working the day Next
stops stripping it — but is now documented as inert rather than load-bearing. A side effect worth
naming: the `bhavano_city` corruption that guard was written for was therefore **never actually
fixed**; this gate is what fixes it.

**Known cost, accepted.** A client-side `<Link>` navigation is an RSC request, so it reads as
`empty` and is **not counted**. The trail is now "pages opened as documents", not every route
change. There is no middleware-level fix: a real client-side navigation and a prefetch differ *only*
by the header Next strips. Listing views are unaffected (`ListingCard` opens in a new tab, a real
document load); header and category-tab navigation is what is lost. Recovering it needs a
client-side ping on real route changes.

**Also implemented — stop paying for prefetches we don't want.** Counting was the smaller half:
every prefetch is a full uncached server render plus real Postgres queries, because every BFF fetch
in the web app is `cache: "no-store"`. `9119370` had already recorded that reasoning when it refused
Chrome's prefetch proxy outright via `/.well-known/traffic-advice`; it applies equally to our own
prefetching, which it had never been applied to. `prefetch={false}` now on the two densest,
lowest-intent surfaces: the listing-card links, and the whole footer. Crawlers are unaffected —
`prefetch` governs only the client router, never the server-rendered `<a href>` they follow.

A 2-second same-path dedupe in `AnalyticsService.recordPageView` backs this up as a safety net, on
the reasoning that the gate matches request *shapes* and the next unrecognised fetcher may present
a new one. It would have removed the 3.51× duplication on its own.

---

## Part 3 — Two bugs were destroying Google Ads attribution (implemented)

`Visit` has **four writers carrying independent facts with different lifetimes**, and they were
contending over row *creation*:

| writer | owns | knowable |
|---|---|---|
| `recordVisit` | source, medium, campaign, gclid, campaignId, adGroupId, adId, true landingPath | only on the landing request |
| `backfillMissingVisit` | nothing — only that the session exists (+ ip/geo/deviceType/isBot) | on any request |
| `linkVisitToUser` | userId | later, if the visitor logs in |
| `confirmJsExecution` | jsConfirmedAt | after the page runs JS |

Web's middleware fires the first two **at the same instant** on a session's first request (both as
unordered `event.waitUntil` fetches, pageview dispatched first).

**Bug A — the empty update.** `recordVisit` was `upsert ... update: {}`, so when the
attribution-less backfill created the row first, every source/medium/campaign/gclid was silently
discarded. Attribution was present on 100% of `Visit` rows before the backfill shipped (979/979 at
03:00Z) and ~50% after (193/382 at 08:00Z).

**Bug B — the collision.** Prisma's `upsert` is a select-then-insert, not `INSERT ... ON CONFLICT`.
Both callers saw "no row", both inserted, and the loser threw P2002 → HTTP 500 → web swallows it by
design → that session's whole attribution gone. Production logs showed `/analytics/visit` failing
**71% of the time** (32 of 45 calls).

**Implemented.** Each writer is now a single atomic `INSERT ... ON CONFLICT` touching only the
columns it owns (raw SQL via `$executeRaw`, all values bound parameters):

- `recordVisit` — every attribution column plus landingPath/ip/geo/deviceType/isBot, each gated on
  the *single* predicate `"Visit"."source" IS NULL`, so attribution lands as a unit and can never
  be half-written from two different requests. `userId` is absent from the statement entirely, so a
  first-touch write cannot unclaim a session.
- `backfillMissingVisit` — `ON CONFLICT DO NOTHING`. It owns no column another writer could want.
- `linkVisitToUser` — `COALESCE("Visit"."userId", EXCLUDED."userId")` and nothing else.
- `confirmJsExecution` — same, for `jsConfirmedAt`, keeping the *first* confirmation.

**Why raw SQL:** Prisma's `upsert` has no per-column merge — its `update` is all-or-nothing. There
is deliberately **no P2002 handler left**: `ON CONFLICT` makes the collision unreachable rather than
recoverable, so a unique-constraint error now means a real bug and should surface.

**Why `randomUUID` for `id`:** `Visit.id` is `@default(cuid())`, which Prisma generates
*client-side* — the column has no database default, so raw inserts must supply one. Giving the
column a DB default was rejected: it would leave `schema.prisma` and the database disagreeing, which
this repo's non-interactive `migrate diff` workflow would try to "correct" on the next unrelated
schema change. The id is opaque, never parsed, never in a URL.

**Rejected: re-deriving lost attribution.** `backfillMissingVisit` leaves attribution null on
purpose. Web's `bhavano_acq` cookie is first-touch across *sessions*, so reading it there would
stamp this session with an earlier one's campaign — turning missing data into wrong data, and
inflating exactly the cpc counts this screen is used to audit. A null `source` is distinguishable
from a real direct visit, which the middleware writes as the literal string `"direct"`.

**Unrecoverable.** Rows written between 13:30 and 17:17 IST on 2026-09-16 have no attribution
anywhere to restore from: the gclid was never persisted server-side, and `PageView` stores only the
path, not the query string. `User.acquisition*` was never affected — it reads the cookie at signup
on a separate path, so signup attribution and the Google Ads conversion uploads were never
corrupted.

---

## Part 4 — A signal a client cannot fake (implemented)

Every human/bot signal above is a header the client **chooses for itself**. `isBot` is a substring
match on the User-Agent, so a scraper announcing itself as Safari passes it — measured: datacentre
hosts in `43.159.0.0/16` (Tencent Cloud, no PTR) logging as `deviceType: mobile`, `isBot: false`,
`source: direct`.

**Implemented.** `Visit.jsConfirmedAt`, set once per session by the browser itself:
`JsConfirmation` (a leaf client component in the root layout, remembered in `sessionStorage`) →
`/api/analytics/confirm` (a Next route handler that reads the httpOnly `bhavano_sid` server-side) →
BFF. The admin Traffic filter gains **"JS-confirmed only (strictest)"**.

Executing a JS engine is a *capability*, not a claim. Deliberately **nothing is fingerprinted** —
no `navigator.webdriver`, no canvas, no device details — and the endpoint accepts no client-supplied
facts beyond the session id (the timestamp is `NOW()`). The signal *is* the request. That keeps it
collecting nothing new, so it needs no privacy disclosure beyond what `/privacy` already says about
the session cookie, which matters with the App Store privacy questionnaire and ATT answers already
filed. This is why the IP layer was preferred over the browser layer throughout (see the audit
below).

- **A timestamp, not a boolean**: same cost, and the gap from `createdAt` shows how long after the
  request the page came alive. Never written `false` — absence is the negative case.
- **Null covers three things it doesn't distinguish**: pre-dates the column, JS never ran, or the
  beacon didn't land. Treat as "unconfirmed", never as "not a human". It undercounts by design.
- **The route handler hop exists** because `bhavano_sid` is httpOnly and stays that way: a client
  that could name its own session id could confirm somebody else's.
- **Default filter stays `humans`**, not `js_confirmed`, because the latter only has history from
  2026-09-16 — defaulting to it would make every older session vanish. Revisit once there is a full
  window.

**Rejected: migrating visit logging to a JS beacon wholesale.** It would mean reworking the httpOnly
session id, losing the trail for non-JS clients, and duplicating GA4 (already present via GTM). The
hybrid keeps the server-side log and adds one column.

---

## Part 5 — Self-referral (implemented)

28 sessions in one day were recorded as `source: www.bhavano.com`, `medium: referral`, and 347 in a
week as `bhavano.com` — the site referring to itself, inflating referral and hiding where those
visitors actually came from.

**The first fix was wrong, and the correction matters.** It was blamed on apex-vs-www and fixed by
stripping `www.` before comparing against `request.nextUrl.hostname`. That never matched in
production: **behind Caddy, `nextUrl` carries the internal origin the container was reached on, not
the public name**, so *every* internal navigation was logged as a referral. The data had already
said so — `www.bhavano.com` appearing as a referral source cannot be produced by an apex/www
mismatch, since a www request would only ever see the apex as foreign.

The public host now comes from `x-forwarded-host`, then `host`, with `nextUrl` as a last resort for
the dev server; port and a leading `www.` are stripped from both sides, with no hardcoded domain, so
it works on localhost and preview hosts. A different subdomain (`admin.bhavano.com`) is still a
referral — separate property. These headers are client-supplied, which is harmless: spoofing one
only records "direct" instead of a referral for that session, and nothing about access, routing or
rendering is decided from it.

---

## Where this leaves us against the standard layers

Audited against the usual bot-detection checklist:

| layer | status |
|---|---|
| A. User-Agent filtering | **done**, hand-rolled (not a maintained list like `crawler-user-agents`) |
| B. IP / ASN reputation | **~10%** — MaxMind GeoLite2-**City** only, for labels. No ASN database, no reverse-DNS verification, no bot-reputation list |
| C. Behavioural | **~25%** — header-shape gate and a dedupe done; JS-confirmed added; no mouse/scroll/focus, no headless fingerprinting, no crawl-order detection |
| D. Honeypots | **none** |
| E. Rate / pattern | **~30%** — `@Throttle` protects the endpoints, but nothing *classifies* a session by its rate (the 656-view session was inside the limits) |

**Deliberately not adopted**, with reasons: client-side fingerprinting (privacy/App Store cost, and
an arms race with no upside here); mouse/scroll tracking (only pays off at far higher volumes);
honeypots *for analytics* (wrong tool — though a honeypot on the **posting form** may be worth it
as spam prevention: 12 distinct foreign IPs probed `/post` once each in a day); Cloudflare Bot
Management or AWS WAF (we are on Caddy on a single VPS — moving the edge is a real infrastructure
decision, not an analytics side effect); Plausible/PostHog (GTM and GA4 already exist); a columnar
store (165k rows).

**Next rungs, in order, if this needs to go further:**

1. **GeoLite2-ASN** — datacenter vs residential is the strongest cheap signal, offline, no network
   call on the write path. `scripts/update-geolite.sh` and `GeoIpService` already handle one mmdb.
2. **Reverse+forward DNS verification as a background job** over recent rows, cached per IP, never
   on the live request. Names the crawler rather than just excluding it, and answers the Googlebot
   crawl-coverage question Part 1 gave up.
3. **Client-side page-view ping** for in-app navigations (the accepted gap in Part 2).

**A free sanity check available today:** GA4 already collects JS-verified sessions through GTM.
Comparing its session count against the Page visits screen measures the remaining bot share with no
code at all.

---

## Verification performed

- **`apps/bff/scripts/check-visit-merge.ts`** (new, committed) — the merge semantics against a real
  Postgres, which mocks cannot prove: both orderings keep full attribution, the real landing path
  beats the backfill's guess, a duplicate send cannot rewrite a first touch, login and attribution
  cannot disturb each other in either order, a second account cannot steal a claimed session, the
  beacon and attribution cannot disturb each other, a repeat beacon keeps the first timestamp, and
  20 genuinely concurrent first-requests produce 20 rows with attribution intact. **12/12 pass.**
  Run it after touching any of that SQL.
- **Against production**, 12 concurrent first-requests through the real endpoints: 12/12 HTTP 200
  (no 500s), 12/12 rows with source, medium, gclid, campaignId and adGroupId intact; test rows
  deleted afterwards.
- **A real ad click end-to-end**: `source=google, medium=cpc, gclid=…, campaignId=…, adGroupId=…`
  with `jsConfirmedAt` landing 546ms after the visit. A beacon with no session cookie no-ops rather
  than creating a phantom session (row count unchanged).
- **Four referer variants as new sessions**: apex → `direct`, www → `direct`, facebook.com →
  `www.facebook.com`/`referral`, admin subdomain → `admin.bhavano.com`/`referral`.
- **Six request shapes against the navigation gate**: a `document` navigation logged; a bare
  `fetch` (`empty`, no RSC), a Next prefetch, and a `Sec-Purpose: prerender` all dropped.
- **Attribution coverage by hour** confirming the sequence of fixes: 3/22 at 10:00Z (collision
  live) → 12/25 at 11:00Z (P2002 fix mid-hour) → 3/3 at 12:00Z (ON CONFLICT build).
- **The first half hour of live traffic after Part 4** — every `direct`/foreign/desktop session
  (Iraq, France, UAE, Bolivia) came back `isBot: false` **and** `js_confirmed: false`, i.e. the old
  signal called all of them human and the new one excluded every one.
- 13 unit tests in `analytics.service.spec.ts` (statement shape, bound parameters, and per-writer
  column ownership — the invariant that actually broke); 277 passing across the BFF. The two
  failing suites (`listings.service`, `app.module.di`) are pre-existing and fail on a clean tree.

## Not yet done

- The three next rungs listed above.
- Historic attribution for 2026-09-16 13:30–17:17 IST is **unrecoverable**, not pending.
- Pre-filter history (165,781 rows) is left in place under the `unclassified` Traffic option, not
  purged.
