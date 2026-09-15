# Consolidate the stray "Delhi" city into Google-matching "New Delhi"

## Context

The area-retry backfill (`backfillMissingContactAreas.ts`) found that all 20 "Delhi"-tagged
outreach contacts and 1 "Noida"-tagged contact are blocked because their coordinates resolve, via
Google's own Geocoding API, to a **different** city than the one they're currently tagged with.
Investigating why revealed the real shape of the problem:

- **`cmtqwm9wr005h01p90uu9gqve` ("Delhi")** — has 3 real listings and a handful of Areas, but
  every one of those Areas is a building/apartment name ("Block 12A", "Pocket 3", "A Block") with
  `lat/lng: null` — not real curated neighborhoods. This row was clearly auto-created by some
  bulk-import path that only ever had building-level text to work with, never matched against the
  already-seeded regional city.
- **`cmtmdwoex04zj01qm58c88e31` ("New Delhi")** — 0 listings, auto-created by `ensureCity`
  (`apps/bff/src/locations/locations.service.ts:165-186`) the first time Google's Geocoding API
  literally returned `"New Delhi"` as a locality for some prior call. **This is the name Google
  Maps itself uses** — confirmed empirically: reverse-geocoding several of the 20 stuck contacts'
  own coordinates, and several of "Delhi NCR"'s own seeded areas (Karol Bagh, Lajpat Nagar), both
  land on this exact city.
- **I originally proposed merging into `cmrkwg8hf00034qqu9bqj8qh9` ("Delhi NCR")** — checking that
  against the user's actual requirement ("the city name we adopt should be Google Maps matching")
  disqualifies it: reverse-geocoding "Delhi NCR"'s own seeded areas shows it's a mix of at least
  three genuinely distinct Google cities — Connaught Place → `"Delhi"`, Karol Bagh/Lajpat Nagar →
  `"New Delhi"`, Faridabad → `"Faridabad"`, Gurugram Cyber City → `"Gurugram"` (the latter two are
  in Haryana, a different state). "Delhi NCR" is a deliberate broader-region grouping, not a
  single Google-matching place — so it's excluded as a merge target here.
- **A mistake made during this investigation, disclosed rather than buried**: `reverseGeocodeGoogle`
  is not actually read-only — it calls `ensureArea`/`ensureCity` as part of resolving a result,
  which can create rows. Running it against a few of "Delhi NCR"'s coordinates while investigating
  accidentally created one junk city, `"Metro"` (Dwarka's coordinates resolved to a metro-station
  address Google mis-parsed as a locality), plus a handful of stray `Area` rows tied to those
  test calls. These have 0 listings/contacts on them and are cleaned up as part of this same fix.

**Scope decision**: fix only what's actually blocking real work — the 20+1 contacts and 3
listings currently on the bad `"Delhi"` row — by consolidating them onto the already-existing,
already-Google-matching `"New Delhi"` row. **"Delhi NCR"'s own internal mixing of New Delhi/
Faridabad/Gurugram is explicitly out of scope for this plan** — it already has published listings
and may be an intentional "browse the broader region" grouping, not obviously a bug; untangling it
is a separate, larger, SEO-sensitive decision (would need to migrate existing listings and
possibly split it into per-city rows) that shouldn't be bundled into unblocking these contacts.

## What this plan does

One script, `apps/bff/prisma/consolidateDelhiCity.ts`, run once against prod the same way the
last two backfills were (`docker cp` + `docker compose exec bff npx tsx ...`), since
`apps/bff/prisma` isn't bind-mounted into the running container (established in this session).

1. **Look up both cities by id, assert their names** (`findUniqueOrThrow` on the two ids named
   above, checking `name === 'Delhi'` / `'New Delhi'` respectively) — fails loudly rather than
   silently touching the wrong rows if either id has somehow changed since this was written.
2. **Reparent every `Area` currently under the bad "Delhi" city** (`Block 12A`, `Pocket 3`,
   `Pocket 6`, and the others listed earlier) to New Delhi's `cityId` — a plain `updateMany`, no
   need to touch the 3 listings' `areaId` at all since the Area rows keep their own identity.
3. **Update the 3 `Listing` rows** currently on the bad "Delhi" city to New Delhi's `cityId`.
4. **Re-run the area-resolution retry for the 20 stuck "Delhi" contacts**, this time accepting a
   match against **either** the contact's current cityId **or** New Delhi's cityId (broadening
   `backfillMissingContactAreas.ts`'s original same-city-only safety check, now that we've
   deliberately decided New Delhi is the right target for these) — sets both `cityId` and
   `areaId` on each. The 1 "Noida" contact that resolved to a village-level `"mirgaon"` locality
   is left untouched by this script — that's a different, lower-quality geocode result on an
   already-correct city, not a Delhi-consolidation case; it still needs the manual CSV route.
5. **Delete the now-empty bad "Delhi" city row** (assert 0 remaining listings/contacts/areas on
   it first, so this fails loudly instead of silently deleting something still in use).
6. **Delete the accidental "Metro" city** and its associated test-created `Area` rows, same
   "assert empty first" guard.

## SEO/URL note, flagged rather than silently decided

Moving the 3 listings' `cityId` changes their canonical browse URL's city segment (`buildListingPath`
uses the city slug) from whatever `"Delhi"` slugifies to, to `new-delhi`. Given this repo's own
URL-consistency convention (`docs/plans` elsewhere: "when changing how a URL is built, keep the old
form resolving"), the fully-correct move would be a redirect for the old slug. Given these are only
3 listings created very recently (minimal indexing/backlink exposure), I'm treating a plain URL
change as acceptable here rather than building a redirect for it — flagging this explicitly as the
one place this plan knowingly accepts a small URL-stability cost, rather than deciding it silently.

## Verification

- Before running: re-confirm via the public API that `cmtqwm9wr005h01p90uu9gqve` still has exactly
  3 listings and `cmtmdwoex04zj01qm58c88e31` still has 0, so the "assert empty before delete" guard
  isn't surprised by drift since this was written.
- After running: `GET /listings?cityId=cmtmdwoex04zj01qm58c88e31` should show the 3 formerly-"Delhi"
  listings; `GET /listings?cityId=cmtqwm9wr005h01p90uu9gqve` (now deleted) should 404 or return
  empty depending on how `LocationsService` handles an unknown id — confirm which, and that it
  doesn't throw an unhandled 500 anywhere a stale bookmark/link to the old city might still hit.
- Re-run `reportMissingContactAreas.ts` — should report 1 remaining (the Noida/mirgaon contact),
  down from 21.
- Confirm the admin's "Create listing" action now succeeds for the 20 newly-fixed contacts.

## Critical files

- `apps/bff/prisma/consolidateDelhiCity.ts` (new) — the one script doing all of the above, same
  `PrismaPg` adapter pattern as `backfillSharingTypeMultiSelect.ts`/`backfillMissingContactAreas.ts`.
- No application code changes — this is purely a one-off data-consolidation script, same category
  as the last two. `ensureCity`'s exact-match behavior (the root cause of the drift) is deliberately
  left untouched per its own doc comment's documented incident; not proposing a change to it here.
