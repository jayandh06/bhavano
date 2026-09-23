# Fix wrong-city geocoding (village/ward mistaken for its own city)

> **Superseded for new pins.** Reverse geocoding no longer calls `ensureCity`. A pin inside a curated city's catchment stays that city, and the local place is an area. Existing auto-created cities are reassigned from lat/lng and deleted. See [canonical-city-catchment.md](canonical-city-catchment.md).

## Context

When a seller drops a map pin, Google's Geocoding API sometimes tags a ward/suburb *inside* an
already-curated Bhavano city with its own `locality` name (e.g. "New Siddhapudur" inside
Coimbatore, "New Delhi" inside what should be the seeded "Delhi"/"Delhi NCR" row). Bhavano's
current resolution logic trusts that `locality` string at face value and auto-creates it as a
brand-new top-level `City` row. This has already happened for real
(`docs/plans/consolidate-delhi-city-google-matching.md` documents the Delhi/New Delhi incident,
fixed only by a one-off manual script) — that plan's own closing note says *"`ensureCity`'s
exact-match behavior (the root cause of the drift) is deliberately left untouched."* This plan
finally addresses that deferred root cause, pan-India, instead of patching one city at a time.

**Root cause, precisely** (`apps/bff/src/locations/locations.service.ts:230-309`,
`reverseGeocodeGoogle`): it reads only `locality`, `sublocality`/`sublocality_level_1`, and
`administrative_area_level_1` (state) from Google's `address_components` — never
`administrative_area_level_2` (district), which for most Indian metros is literally the city name
Bhavano already has seeded ("Coimbatore", "Chennai", "Bengaluru Urban", …). When Google supplies a
distinct sublocality (`noDistinctSublocality === false`), the code skips straight to
`ensureCity(locality.long_name, state.long_name, lat, lng)`, which does its own plain
case-insensitive exact-match against `(name, state)` and — finding no city literally named "New
Siddhapudur" — creates one. There is no cross-check against the district, no check for "is this
already inside a curated city we operate in," and no way to patch a specific known-bad locality
without a code change.

On the client side (both web and mobile `PostAdWizard.tsx`), `onPinChange` also unconditionally
overwrites whatever city was already selected the moment a reverse-geocode resolves *any* city —
even a wrong one — with no confirmation step. Web's own `Autocomplete` search box additionally has
zero country restriction (mobile's server-side one already has `components=country:in`).

## Approach

Three independent, separately-shippable pieces. Phase 1 alone fixes the reported bug class with no
client changes at all; Phases 2–3 close the remaining gaps the user's brief calls out.

### Phase 1 — Backend resolution priority chain (the actual fix)

All changes in `apps/bff/src/locations/locations.service.ts`'s `reverseGeocodeGoogle`
(lines 230-309). Keep every existing method (`ensureCity`, `ensureArea`, `findNearestCuratedCity`)
exactly as-is — this only changes what gets tried *before* falling through to them, so the existing
new-city and small-town safety nets are preserved for genuinely new/uncovered cities.

New sequential priority, replacing the current single `locality`-exact-match lookup
(lines 281-297):

1. **`LocalityAlias` table (new, exact/insensitive match)** — an admin-patchable override,
   checked first against whichever Google name is most specific (`resolvedLocality`, else
   `locality.long_name`). This is the data-only "New Siddhapudur → Coimbatore" patch path from the
   brief's point 3 — no deploy needed to add one, just a row.
2. **District match against curated cities only** (`administrative_area_level_2`, light suffix
   normalization stripping a trailing " Urban"/" Rural"/" District" first — Indian metro districts
   commonly carry these, e.g. "Bengaluru Urban"). This is the brief's point 1/2 combined: it uses
   data Bhavano already has (the `source: 'curated'` rows *are* the canonical-city master list)
   and fixes the reported Coimbatore/Chennai class with zero new data, since seeded rows already
   exist for both.
3. **Existing locality match against all cities** (today's original check, unchanged) — kept so a
   locality that was already correctly resolved/fixed before (curated or a prior legitimate
   user-submitted city) keeps matching.
4. **Existing `noDistinctSublocality` → `findNearestCuratedCity`, else → `ensureCity` auto-create**
   (today's code, byte-for-byte unchanged) — now only reached when 1–3 all miss, i.e. a genuinely
   unrecognized place.

New Prisma model:

```prisma
model LocalityAlias {
  id        String   @id @default(cuid())
  name      String   @unique
  cityId    String
  city      City     @relation(fields: [cityId], references: [id])
  createdAt DateTime @default(now())
}
```

(`City` gets a back-relation field `localityAliases LocalityAlias[]`.) Migration via
`pnpm exec prisma migrate dev --name locality_alias` against local Docker Postgres, then
`prisma migrate deploy` on prod the same way this session's other migrations went out.

Seeding/patching aliases: no admin UI in this pass — city/area data in this app is already
managed via one-off scripts (`apps/bff/prisma/seedCities.ts`, `consolidateDelhiCity.ts`), not a
CRUD screen, so a small `apps/bff/prisma/addLocalityAlias.ts` (name + city id/name args, same
`PrismaPg` adapter pattern as the existing scripts) is the consistent way to add "New
Siddhapudur" → Coimbatore and similar known cases as they surface. An admin UI is a reasonable
future follow-up, not bundled here.

### Phase 2 — considered, reverted: confirm-before-switching-city on pin-drop

Originally implemented as: `onPinChange` in both `apps/web/src/components/home/PostAdWizard.tsx`
and `apps/mobile/src/components/home/PostAdWizard.tsx` would stop calling
`onCityChange(suggestion.cityId)` unconditionally, and instead surface a mismatch note ("Use
`{suggested city}`" / "Keep `{current city}`") whenever a pin resolved to a *different* city than
the one already selected, applying only on explicit confirmation.

**Reverted at the user's explicit direction** ("Instead asking user use `<city>` set the city
automatically") once Phase 1 shipped: with the backend priority chain now resolving the correct
city in the case this was guarding against, the confirmation step was redundant friction rather
than a real safeguard — `onPinChange` on both platforms went back to applying `suggestion.cityId`
directly, no confirmation, exactly as it worked before this plan (see each file's own updated
`onPinChange` doc comment). Phase 1 is what actually makes that direct-apply trustworthy again.

### Phase 3 — Constrain the web search box to India

`apps/web/src/components/home/LocationMapPicker.tsx:125` currently constructs
`new google.maps.places.Autocomplete(searchInputRef.current)` with no options at all — it can
suggest addresses anywhere in the world. Add `componentRestrictions: { country: "in" }`, matching
the restriction the BFF's `placeAutocomplete` (used by mobile's search box) already applies
server-side (`locations.service.ts:322`, `components=country:in`). One-line, pure upside, no
behavior change for a legitimate Indian address search.

## Explicitly out of scope

- Fuzzy/partial district-name matching (e.g. "West Godavari" ~ "Godavari") — exact-match-after-
  light-normalization only, to avoid trading one false-positive class for another. If gaps remain
  after Phase 1 ships, they become new `LocalityAlias` rows, not a fuzzier matcher.
- An admin UI for managing `LocalityAlias` rows — scripted for now, matching how City/Area rows
  are already managed.
- Re-litigating already-shipped decisions from `docs/plans/consolidate-delhi-city-google-matching.md`
  (Delhi NCR's internal Delhi/Faridabad/Gurugram mixing) — unrelated, already explicitly deferred
  there.
- A soft-bias `bounds` on the web Autocomplete toward the currently-selected city — country
  restriction is the clear, low-risk win; city-level biasing would be a separate UX refinement.
- Confirm-before-switching-city on pin-drop — see Phase 2 above; tried and reverted.

## Critical files

- `apps/bff/prisma/schema.prisma` — new `LocalityAlias` model + migration.
- `apps/bff/src/locations/locations.service.ts` — the priority-chain rewrite inside
  `reverseGeocodeGoogle`; no changes to `ensureCity`/`ensureArea`/`findNearestCuratedCity`.
- `apps/bff/prisma/addLocalityAlias.ts` (new) — one-off script to add an alias row, mirroring
  `seedCities.ts`'s style.
- `apps/bff/src/locations/locations.service.spec.ts` — new tests for the priority chain (alias
  wins over district wins over locality wins over legacy fallback), mocking `global.fetch` for
  `reverseGeocodeGoogle` and reusing the existing `makeService` Prisma-mock helper for `ensureCity`/
  `ensureArea` pass-through behavior.
- `apps/web/src/components/home/LocationMapPicker.tsx:125` — `componentRestrictions: { country:
  "in" }` on the `Autocomplete` constructor.

Both `PostAdWizard.tsx` files' `onPinChange` were touched then reverted back to their original
direct-apply form — see Phase 2 above.

## Verification

1. `pnpm --filter bff test` — new `locations.service.spec.ts` cases: (a) a mocked Google response
   with a `LocalityAlias` row present resolves to that alias's city even when locality/district
   would otherwise miss; (b) a response whose `administrative_area_level_2` matches a curated
   city (simulating the Coimbatore/"New Siddhapudur" case) resolves to that curated city rather
   than calling `ensureCity`; (c) existing `ensureCity`/`ensureArea` tests still pass unchanged.
2. `pnpm --filter bff typecheck` after the Prisma migration (regenerates the client with the new
   `LocalityAlias` model).
3. Migration: dev via `prisma migrate dev` against local Docker Postgres, then `prisma migrate
   deploy` on prod, same process used earlier this session; verify with `prisma migrate status`.
4. Manual: drop a pin on a real coordinate known to reproduce the bug class (a ward inside a
   curated city with a distinct Google sublocality) and confirm it now resolves to the existing
   curated city, not a new one — check via the admin's city list that no new stray city was
   created.
5. Confirm a pin genuinely outside any curated city (a real uncovered town) still auto-creates a
   new city as before — Phase 1 must not block legitimate expansion into new cities.
6. Web: type a non-Indian address into the search box and confirm no suggestions appear (or only
   Indian ones), matching mobile's existing behavior.
