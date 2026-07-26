# Support posting listings in uncovered cities/areas from the map picker

## Context

The posting wizard's Google Maps location picker reverse-geocodes a dropped pin
and tries to resolve it to Bhavano's curated `City`/`Area` tables. Per
`docs/plans/google-maps-location-picker.md`, this was deliberately built as
**match-only for City** ("if the resolved locality doesn't match an existing
City, surface that directly... rather than silently creating a placeholder"),
while Area already auto-creates via `LocationsService.ensureArea`.

That "surface it" half was never actually built. Today, when a pin lands in a
city Bhavano doesn't have, `reverseGeocodeGoogle` correctly returns
`cityId: undefined`, but `PostAdWizard.onPinChange` just no-ops on a falsy
`cityId` — City/Area fields silently keep whatever stale/default value they had
before. The seller sees a brief "Looking up this location…" spinner and then
nothing, with no indication their pin landed somewhere unsupported. The listing
can still be submitted, but gets misfiled under an unrelated City/Area.

The requested change reverses the original "never auto-create City" call: an
uncovered city (and its area) picked on the map should now be supported —
auto-created immediately-live, the same way Area already works — instead of
either silently failing or hard-blocking the seller. (Confirmed with the user:
new cities go live immediately, mirroring Area's existing pattern, not gated
behind a new admin-review flow — building that would require admin tooling
that doesn't exist today in `apps/admin`.)

## Approach

Mirror the exact pattern `ensureArea` already established for Area, add the
missing piece of Google address data (state) needed to satisfy `City`'s schema,
and fix the client so a freshly-created city actually renders and gets
communicated to the seller instead of being silently dropped.

### 1. Prisma: `City.source` field

Add `source String @default("curated")` to the `City` model in
`apps/bff/prisma/schema.prisma`, matching `Area.source` exactly. Lets future
admin tooling distinguish curated vs. user-submitted cities later without
guessing. Run the standard migration (`pnpm --filter bff prisma migrate dev
--name add_city_source`) — additive column with a default, non-breaking.

### 2. BFF: `LocationsService.ensureCity` (new method, `apps/bff/src/locations/locations.service.ts`)

```ts
async ensureCity(name: string, state: string, lat: number, lng: number): Promise<City | null> {
  const trimmedName = name.trim();
  const trimmedState = state.trim();

  const existing = await this.prisma.city.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' }, state: { equals: trimmedState, mode: 'insensitive' } },
  });
  if (existing) return existing;

  // Guard against a slug collision with an existing city in a *different* state (e.g. two
  // "Springfield"s) — `resolveCity` (apps/web/src/lib/browseRoute.ts) matches purely on
  // slugify(name) with no state disambiguation in the URL, so a same-slug duplicate would be
  // permanently unreachable/misrouted. Skip creation and fall back to the existing "not
  // supported here" experience for this rare case rather than creating an unreachable city.
  const allCities = await this.prisma.city.findMany();
  if (allCities.some((c) => slugify(c.name) === slugify(trimmedName))) return null;

  return this.prisma.city.create({
    data: { name: trimmedName, state: trimmedState, lat, lng, source: 'user-submitted' },
  });
}
```

Import `slugify` from `@bhavano/types/slugify` (already a runtime export, already
depended on by `apps/bff`).

### 3. BFF: wire it into `reverseGeocodeGoogle`

Currently (`locations.service.ts:167-184`) only extracts the `locality`
component and matches City by name alone. Extend to:

- Also extract `administrative_area_level_1` (state) from
  `result.address_components`.
- When no existing City matches by name+state, and both `locality` and `state`
  were resolved: call `ensureCity(locality.long_name, state.long_name, lat, lng)`
  using the **dropped pin's own coordinates** as the new city's `lat`/`lng` —
  same-quality approximation Google's response offers without a second API
  call, consistent with Area's existing precedent of not needing pinpoint-exact
  centroids.
- If `state` couldn't be extracted, or `ensureCity` returned `null` (slug
  collision), leave `cityId` undefined exactly as today — this preserves the
  original "not supported" fallback for the genuinely rare cases, rather than
  creating a bad row.
- Once a city exists (matched or newly created), proceed to `ensureArea` exactly
  as today (no change to that call).

Extend `ReverseGeocodeResultDto` (`packages/types/src/index.ts`) with two
optional fields the client needs:

```ts
cityName?: string;   // display name for a city that may not be in the wizard's initially-fetched list
isNewCity?: boolean; // true when this call just created the city (drives the "we added it" note)
```

Populate both from the resolved/created `City` row in `reverseGeocodeGoogle`'s
return.

### 4. Client: `PostAdWizard.tsx`

- `cities` prop is currently used directly for the City `<select>` (line
  341-347), the map's default center (line 333), and the review-step display
  (`cities.find(...)`, line 491) — all of which would silently break (blank
  select value, missing name) if `cityId` gets set to a city not in that
  fetched-once list. Rename the prop to `initialCities` and add
  `const [cities, setCities] = useState<City[]>(initialCities)` so the list can
  grow.
- In `onPinChange` (line 181-190): when `suggestion.cityId` is present and not
  already in `cities`, append a synthesized entry (`{ id, name: suggestion.cityName
  ?? suggestion.resolvedLocality, state: "", lat: nextPin.lat, lng: nextPin.lng,
  isPopular: false }`) via `setCities` before calling `onCityChange`, so the
  `<select>` and review step render correctly right away.
- Add a small informational note (same placement/style as the existing "will be
  added as new area" note at line 375-379):
  - When `suggestion.isNewCity`: "We've added **{cityName}** as a new city on
    Bhavano — this could be the first listing there!"
  - When the lookup ran but `suggestion.cityId` is still falsy (the rare
    state-extraction/slug-collision fallback): "Couldn't confidently match a
    city here — please pick City/Area manually below." This replaces today's
    total silence for that residual case, closing the original design doc's
    unmet verification requirement for the sliver of cases that still fall
    back.
- No changes needed to `detailsValid` or `onSubmit`/`createListingAction` — by
  the time the seller submits, `cityId` already refers to a real, persisted
  City row either way.

### 5. `LocationMapPicker.tsx`

No changes needed — its `error` state is about map/script load failures only,
unrelated to this flow, and stays that way.

## Files touched

- `apps/bff/prisma/schema.prisma` (+ generated migration) — add `City.source`.
- `apps/bff/src/locations/locations.service.ts` — `ensureCity`, state
  extraction, wiring into `reverseGeocodeGoogle`.
- `packages/types/src/index.ts` — extend `ReverseGeocodeResultDto`.
- `apps/web/src/components/home/PostAdWizard.tsx` — local `cities` state,
  append-on-miss, new informational notes.

## Notable accepted gaps (not fixing now, consistent with existing Area gaps)

- New cities default `isPopular: false` with no promotion path, and have no
  entry in `packages/types/src/cityIcons.ts`'s hardcoded emoji map — purely
  cosmetic (renders without an icon, sits in the "more cities" tier), exactly
  like Area's existing `lat: null` gap for user-submitted areas.
- SEO: a new City immediately gets a working browse route, canonical URL, and
  sitemap entry, since routing/sitemap generation is already fully data-driven
  off the City/Area tables and actual listings (no hardcoded city list
  anywhere in the routing path) — this is new, additive pages appearing, not a
  change to any existing route/URL structure.

## Verification

1. `pnpm --filter bff exec prisma migrate dev` runs clean; `City` rows still
   read/write fine.
2. `pnpm --filter web tsc --noEmit` / `pnpm --filter bff` build, and
   `eslint` on the touched files — all clean.
3. Manual, via `pnpm dev`: open the post-ad wizard, drop a map pin somewhere
   with no seeded City nearby.
   - City `<select>` updates to the new (correctly-named) city and stays
     selected; the "we've added this city" note appears.
   - Submit the listing successfully.
   - Query the DB (or Prisma Studio) to confirm exactly one new `City` row
     (`source: 'user-submitted'`) and one new `Area` row were created.
   - Visit the new city's browse page (`/<new-city-slug>`) and confirm it
     200s and shows the new listing.
   - Drop a second pin in the same new city on another post attempt and
     confirm no duplicate `City` row is created (case-insensitive name+state
     match hits the existing row).
4. If two same-named-but-different-state cities can be arranged in test data,
   confirm the slug-collision guard falls back to the "couldn't confidently
   match" note instead of creating an unreachable duplicate.
