# PlacesFetchLog — a real table for scrape history, replacing fetched_state.json

`get_pg_coworking_leads.py` previously tracked which `(city, area, category)` combinations it had
already searched in a local JSON file (`--state-file`, default `./leads_output/fetched_state.json`)
— a plain boolean "done or not" per combo, living on whichever machine happened to run the script.
Replaced with a real table so this history is durable, shared, and queryable from the admin side,
not stranded on one person's laptop — and richer than a boolean, since the ask was specifically
"when, which area/city/category, and how many records" per search, not just "was this done."

## Why not reuse `OutreachCampaign`?

Considered and rejected — see the conversation this plan comes from. `OutreachCampaign` is built
around *sending messages to an audience* (`channel`, `bodyTemplate`, `dltTemplateId`,
`cadenceCron`, all required or defaulted for that purpose) and is polled by a real background job
(`OutreachCampaignJob`) that sends real messages based on `status`/`scheduledAt`. Forcing
scrape-history rows into it would mean inventing placeholder junk for fields that mean nothing
here, and risks that job actually picking up a fake row and trying to "send" it.

## Design

`PlacesFetchLog` — one row per `(city, area, category)` query **actually run**:

| Field | Purpose |
|---|---|
| `citySearched` | The `--cities` entry as typed — always present, even for a city that never resolved to a real `City` row. |
| `cityId` / `areaId` | Nullable FKs — null exactly when the equivalent `OutreachContact.cityId`/`areaId` would be null for the same reason (unseeded city, or a city-level-only query). |
| `areaSearched` | Null for a city-level-only query, matching the scraper's own `CITY_LEVEL` sentinel logic (now removed — a null `areaId` carries the same meaning without a magic string). |
| `businessCategory` | `pg` / `coworking`. |
| `query` | The literal Places Text Search string sent to Google — kept for debugging a surprising result count without reconstructing it from the other columns. |
| `resultsFound` | Raw Text Search result count, **before** `--min-rating` filtering. |
| `resultsImported` | How many of those were actually built and sent for import — smaller than `resultsFound` whenever the rating filter excluded some. |
| `minRatingFilter` | Null when `--min-rating` wasn't used for that run. |
| `fetchedAt` | When. |

**Deliberately a log, not a cache** — no unique constraint on `(cityId, areaId, businessCategory)`.
Re-running the same combo with `--force` adds a new row rather than overwriting the last one, so
"how many times, and when, have we searched Koramangala for pg" stays a real, answerable question
instead of only ever showing the most recent attempt.

## `OutreachContact.placesFetchLogId` — linking a contact back to its exact run

Added after the initial version of this table: a nullable FK on `OutreachContact` pointing at the
`PlacesFetchLog` row that produced it. Without this, the only correlation available was matching
`OutreachContact.sourceRef` (the query text) against `PlacesFetchLog.query` — ambiguous the moment
the same `(city, area, category)` gets searched more than once with `--force`, since a re-run
produces the identical query string and an upsert doesn't even change the contact's `createdAt`.
`placesFetchLogId` makes "show me exactly what this run produced" a real, precise join.

This is why `PlacesFetchLog` creation had to move **before** the Text Search runs, not after —
covered in the API surface section below.

## API surface

- `GET /admin/outreach/places-fetch-log/fetched-pairs?citySearched=&cityId=` — what the scraper
  checks before querying an area. Matched by `cityId` when resolved, else by `citySearched`
  (case-insensitive) with `cityId IS NULL` — same fallback reasoning `OutreachContact` itself uses
  for an unseeded city. Returns just `{areaId, businessCategory}` pairs — enough to build a skip
  set, not the full log.
- `POST /admin/outreach/places-fetch-log` — creates a row **before** that `(area, category)`
  pair's Text Search runs, with `resultsFound`/`resultsImported` left at their schema default (0).
  Returns `{id}` — the id every contact that search produces carries as its own
  `placesFetchLogId`. This ordering (create first, count later) only exists because of the FK
  above; a counts-only version of this endpoint existed briefly before that was added and needed
  no such split.
- `PATCH /admin/outreach/places-fetch-log/:id` — fills in the real `resultsFound`/
  `resultsImported` once the pair's search + detail-fetch + import cycle is done.

All three are admin-guarded, same as every other outreach endpoint — the scraper already
authenticates as admin to reach the contacts-import endpoint, so this added no new auth
requirement to the *script*, only to the one thing that used to be a local file (checking fetched
pairs now needs the admin JWT even in `--dry-run`, since it's a real BFF call rather than a local
file read).

## What changed in the scraper

- `state_key()`/`load_state()`/`save_state()`/`--state-file`/`CITY_LEVEL` all removed.
- `fetch_fetched_pairs()` / `create_places_fetch_log()` / `update_places_fetch_log_counts()` added
  — thin wrappers around the endpoints above, all best-effort (a network hiccup logs a warning and
  degrades gracefully — treats the city as never-fetched on a failed check, skips linking a
  contact to a log row on a failed create, or leaves a row's counts at their 0 default on a failed
  patch — rather than aborting an otherwise-successful scrape).
- `collect_city()` now creates a `PlacesFetchLog` row per pair *before* searching it (skipped
  entirely in `--dry-run`), threads that row's id through `seen` and into every `build_contact()`
  call for that pair, and returns `pair_stats` (per-pair `{areaId, logId, query, found, imported}`)
  instead of the old `pair_counts` — `main()` PATCHes each row's real counts from this afterward.
- `build_contact()` takes a new `places_fetch_log_id` param, set directly onto the contact dict's
  `placesFetchLogId`.
- The admin JWT is now minted once, up front in `main()`, rather than only right before the final
  `import_contacts()` call — both the fetch-log check and the per-pair log-row creation need it
  much earlier in the run now.
- `--dry-run` still checks `fetched-pairs` (read-only, harmless, keeps the printed skip-count
  accurate) but never calls `create_places_fetch_log()`/`update_places_fetch_log_counts()` —
  matching its existing "don't write anything to the BFF" contract. Contacts built during a dry
  run just carry `placesFetchLogId: None`, harmless since dry-run never imports them anyway.

## Verified

Stub-based tests (no real network calls) for: `fetch_fetched_pairs` parsing and its failure
fallback, `create_places_fetch_log`'s returned id and its failure returning `None` instead of
raising, `update_places_fetch_log_counts`'s payload and its no-op when `log_id` is `None`,
`collect_city`'s skip-already-fetched behavior, the `--force` bypass, the `found` vs. `imported`
distinction when `--min-rating` excludes some results, and — for the FK specifically — that a
normal run's contacts carry the real `logId` while a `--dry-run`'s carry `None` and never call
`create_places_fetch_log` at all. BFF-side (Jest): `listFetchedPairs`'s `cityId`-vs-`citySearched`
matching, `createPlacesFetchLog`'s null-defaulting and returned id, and
`updatePlacesFetchLogCounts`'s patch payload.

## Admin UI — `/outreach/scrapes`

Built after the FK above: a paginated table of every `PlacesFetchLog` row, newest first, with a
"Contacts →" link per row to `/outreach/contacts?placesFetchLogId=<id>` — filtering the contacts
page down to exactly what that run produced, via the real FK. Cross-linked from
`/outreach/contacts` too, including a "showing only contacts from this scrape run" banner (with a
Clear link) when filtered that way.

## `--query-prefix` — custom search terms, not fixed variants

The original ask ("run once for Gents-only PG, once for ladies, once for coliving") could have
been built as a fixed list of hardcoded variants baked into the script. Deliberately not built
that way — a free-text `--query-prefix` CLI flag is more general and doesn't require guessing
exact wording or hardcoding gender logic into the script for every term someone might want to try:

```bash
python3 get_pg_coworking_leads.py --cities Bengaluru --categories pg --query-prefix "Gents PG"
python3 get_pg_coworking_leads.py --cities Bengaluru --categories pg --query-prefix "Ladies PG"
python3 get_pg_coworking_leads.py --cities Bengaluru --categories pg --query-prefix "Coliving PG"
```

City/area are still substituted in dynamically exactly as before (`build_query()` just takes the
resolved noun directly now, instead of looking it up from `QUERY_NOUNS[category]` internally).
Omitting the flag falls back to the existing category default, unchanged.

**`PlacesFetchLog.queryPrefix`** stores the term itself, separately from `query` (which has
city/area already baked in) — specifically so runs can be grouped/filtered by *what* was searched
for, independent of *where*. Surfaced as its own column ("Search term") on `/outreach/scrapes`,
with the full query shown as a small reference line underneath.

**The fetched-pairs skip check is now keyed on `(areaId, businessCategory, queryPrefix)`, not just
`(areaId, businessCategory)`** — this is the part that actually makes multiple targeted runs work
correctly. Without it, running `--query-prefix "Ladies PG"` against an area already scraped under
`--query-prefix "Gents PG"` would have been wrongly skipped as "already fetched." Verified with a
dedicated stub test proving a different prefix is *not* skipped, while the same prefix against an
already-fetched area still is.

No gender-inference change: `guess_gender()` still works purely off the business *name* text,
regardless of which search term found it. A custom prefix changes what gets searched, not how
gender gets tagged — keeping that logic simple and not dependent on the prefix being one of a
fixed set of recognized strings.

## Not built (yet)

Filtering `/outreach/scrapes` by `queryPrefix` itself (e.g. "show me only the 'Gents PG' runs") —
the data supports it, no UI control for it yet. A natural next step if wanted.
