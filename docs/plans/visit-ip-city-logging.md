# Logging a city name alongside `Visit.ip`

## Short answer

Yes, technically straightforward — but this codebase has already tried IP-based city
inference once and pulled it back out, for reasons worth restating before repeating them. This
plan is scoped narrowly enough to avoid that outcome: **admin-facing analytics label only, never
anything that drives what a visitor sees or where they're routed.**

## Relevant history: read before building

`docs/plans/remove-automatic-ip-city-detection.md` removed a MaxMind GeoLite2-based IP→city guess
that fed `resolveDefaultCity` — i.e., it silently chose which city's listings a first-time visitor
saw. It was removed for two reasons:

1. **It never actually ran.** `MAXMIND_LICENSE_KEY` was never set, the `.mmdb` file was never
   downloaded — dead code from day one.
2. **Consent and accuracy.** Guessing a visitor's city from IP and acting on that guess
   automatically is involuntary and — per that doc — coarse enough in India (carriers route large
   regions through a handful of peering cities) to be wrong a meaningful fraction of the time. It
   was replaced with an explicit "auto-detect" button using the browser's real GPS position.

That plan explicitly carved out `Visit.ip` as unrelated and untouched: *"the per-session IP already
logged for analytics and abuse investigation — is unrelated to city defaulting."* This request is
exactly that carve-out — using the same IP, already collected for the same stated purpose (per
`/privacy`: "to investigate abuse and understand how visitors reach the Platform"), to add one more
descriptive field to it. It does not resurrect the removed mechanism because:

- It never changes what any visitor sees, which city is pre-selected, or any routing/redirect
  decision. It only adds a label an admin sees when looking at a user's visit history.
- The accuracy caveat still applies and must be surfaced as such in the admin UI (see below) — not
  hidden behind a plain "City" column that implies certainty it doesn't have.

If that distinction doesn't hold up on reflection, this plan shouldn't proceed — say so and it
gets reworked or dropped rather than built as-is.

## How to derive the city

Two options; recommendation is local lookup, not a third-party API call.

| | Local MaxMind GeoLite2 (recommended) | External API (ipapi.co, ipinfo.io, ip-api.com) |
|---|---|---|
| Privacy | IP never leaves the server | Every visitor's IP is sent to a third party, every visit |
| Cost | Free (MaxMind account + license key) | Free tiers are rate-limited; paid at any real volume |
| Latency | In-process `.mmdb` lookup, sub-millisecond | Network round trip per visit |
| Maintenance | Periodic `.mmdb` refresh (MaxMind ships weekly updates; a stale file still works, just drifts slowly) | None, but a new external dependency to go down or throttle |
| Precedent | Already scaffolded once in this repo (`GeoIpService`, `maxmind` npm package) — recoverable from git history at the commit before `remove-automatic-ip-city-detection.md` | None |

Given `Visit.ip` is already flagged in code as "personal data under the DPDP Act," shipping every
visitor's IP to an unrelated third-party service on every page load is a strictly bigger exposure
than a local lookup that keeps the data in-house. Recommend reviving the local MaxMind approach.

## Schema change

Add nullable columns to `Visit` — additive, no backfill possible for past rows (their IP is on
file, but a lookup wasn't run at write time), no destructive migration:

```prisma
model Visit {
  // ...existing fields...
  /** Best-effort city guess from `ip` via a local MaxMind GeoLite2 lookup, done once at write
   * time. Free text, NOT a foreign key to City — GeoIP naming doesn't reliably match this app's
   * slugified city list (e.g. "Bangalore" vs "Bengaluru"), so don't join against City on this.
   * Null when ip is null, the IP isn't in the database, or the database file isn't present.
   * Admin-analytics label only — never used to decide what a visitor sees. */
  ipCity   String?
  ipRegion String?
  ipCountry String?
}
```

(Naming with an `ip` prefix — `ipCity`, not `city` — is deliberate: it keeps this visibly distinct
from any future real `cityId` relation on `Visit`, and from `User.cityId`/`City`, so nobody mistakes
a GeoIP guess for a verified location.)

## Where the lookup happens

`AnalyticsService.recordVisit()` ([analytics.service.ts](apps/bff/src/analytics/analytics.service.ts)) is the only place a `Visit` row is created. Add
the lookup there, immediately before the `upsert`:

```ts
const geo = dto.ip ? this.geoIp.lookupCity(dto.ip) : null;
await this.prisma.visit.upsert({
  where: { sessionId: dto.sessionId },
  update: {},
  create: {
    // ...existing fields...
    ipCity: geo?.city ?? null,
    ipRegion: geo?.region ?? null,
    ipCountry: geo?.country ?? null,
  },
});
```

`GeoIpService` (revived, same shape as before) wraps the `maxmind` package's reader, opened once at
module init from `GEOIP_DB_PATH`. It must fail soft everywhere: missing env var, missing file, IP
not found in the database, or a private/loopback IP (always true in local dev) all resolve to
`null` — the visit still gets recorded, same as `ip` itself being nullable today.

## What comes back with it (ops)

Reviving this means re-adding the pieces `remove-automatic-ip-city-detection.md` deleted:

- `maxmind` npm dependency and `GeoIpService` (recoverable from git history).
- `GEOIP_DB_PATH` env var + `./data/geoip` bind mount in `docker-compose.prod.yml`.
- `MAXMIND_LICENSE_KEY` in `.env.production.example` — **you'll need a MaxMind account** (free tier
  covers GeoLite2) and to set the real key in prod `.env` yourself, same as any other secret.
- `scripts/update-geolite.sh` (or equivalent) run periodically (e.g. weekly cron) to pull the
  latest `.mmdb` — MaxMind's GeoLite2 files are refreshed on their end regularly; a stale local copy
  still works, just drifts slowly.
- `data/geoip/` gitignore entry.
- MaxMind/GeoLite2 attribution line back in the privacy policy or footer (their EULA requires it
  while you're using the free GeoLite2 database).

## Admin surface

- `VisitDto` ([packages/types/src/index.ts:397](packages/types/src/index.ts#L397)) gains
  `ipCity: string | null` (and optionally `ipRegion`/`ipCountry` if worth showing).
- `AdminService.getUserActivity()`'s `visits.map(...)` ([admin.service.ts:270-277](apps/bff/src/admin/admin.service.ts#L270-L277)) passes the new fields through — no new query, `Visit` rows are already fetched there.
- `apps/admin/src/app/users/[id]/page.tsx` renders it next to the existing IP column, labeled
  something like "City (from IP, approximate)" — not a bare "City" — so nobody mistakes a carrier
  routing guess for a confirmed location. This is the one place this data surfaces; there's no
  separate global "all visits" admin page today, only this per-user activity view.

## Privacy policy

The existing line — *"your IP address and the page you first arrived on, recorded once per
browsing session, to investigate abuse and understand how visitors reach the Platform"*
([privacy/page.tsx:59-60](apps/web/src/app/privacy/page.tsx#L59-L60)) — needs a clause added:
IP is also used to derive an approximate city/region for that same stated purpose. This is an
extension of an already-disclosed use of already-collected data, not a new category of collection —
but the disclosure text should say so explicitly rather than leave it implicit.

## What this deliberately does not do

- Does not touch `resolveDefaultCity`, the web/app startup city resolution, or anything a visitor
  sees. That mechanism stays exactly as `remove-automatic-ip-city-detection.md` left it — the
  cookie/URL-param precedence, with the explicit GPS-based "auto-detect" button as the only way a
  location is ever chosen for a visitor.
- Does not attempt to reconcile `ipCity` against the app's own `City` table. It's a label, not a
  relation.
- Does not backfill existing `Visit` rows — only newly recorded visits get a guess.

## Open question before building

Is the admin-analytics value here (seeing roughly where traffic comes from, per visit) worth
re-standing the MaxMind pipeline (account, license key, periodic `.mmdb` refresh, attribution
notice) for what is ultimately a label with a known accuracy ceiling? If city-level granularity
matters less than a coarser signal, `ipRegion`/`ipCountry` alone from the same lookup might cover
the actual admin need with the same infrastructure cost — worth deciding which fields are actually
wanted before wiring all three.
