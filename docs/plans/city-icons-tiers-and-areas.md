# City icons, tier-2 cities, and expanded area coverage

## Context

The city-selection dialog (`LocationPicker.tsx` on web, the location `BottomSheetModal` in
`HomeSheetsProvider.tsx` on mobile) previously showed a plain text list of the 8 cities marked
`isPopular` in the DB, with a search box that can match *any* city by name/state — but there was no
way to browse a second tier of cities without already knowing to type one, and no visual identity
per city. This adds 4 more popular cities, a genuine tier-2 set of 25 additional cities (browsable
via a "Show more cities" expand, not just reachable by search), a static per-city icon, and curated
localities for every new city — on both web and mobile.

**Confirmed decisions:**
- **4 new popular cities**: Surat, Jaipur, Kochi, Chandigarh — next by real population/real-estate
  significance not already covered. (Gurgaon is already covered — it's seeded as an *area* under
  the existing "Delhi NCR" city, alongside Noida/Faridabad, matching how this app models NCR as one
  metro rather than separate cities.)
- **25 tier-2 cities** (`isPopular: false`), each with curated areas: Nagpur, Indore, Bhopal,
  Coimbatore, Visakhapatnam, Vijayawada, Lucknow, Kanpur, Nashik, Vadodara, Rajkot, Patna, Ranchi,
  Bhubaneswar, Guwahati, Mysuru, Mangaluru, Thiruvananthapuram, Kozhikode, Madurai, Amritsar,
  Ludhiana, Dehradun, Raipur, Panaji.
- **Icons are a static emoji map** in shared frontend code (mirrors the existing category-icon
  pattern in `CATEGORIES`/`HOME_TABS` — no schema migration for what's presentation data).
- **Both web and mobile** get the icon + tier-2/"Show more" treatment.

## Data (`apps/bff/prisma/seed.ts`)

Added the 4 new popular cities (`isPopular: true`) and 25 tier-2 cities (`isPopular: false`) to the
`cities` array, and a curated `areasByCity` entry for all 29 (5-9 well-known real localities each,
approximate lat/lng from general knowledge — same caveat the existing comment already states for
the original 8 cities' data: good coverage, not exhaustive/survey-precise). No schema change needed
— `city.upsert`/`area.upsert` (keyed on `[name,state]`/`[name,cityId]`) are already idempotent, so
re-running the seed against the new arrays just inserts the new rows without touching existing data.

## Backend (`apps/bff/src/locations/`)

`LocationsService.searchCities` gained a third mode alongside "no query → popular-only" and
"query → matches any city": `GET /locations/cities?all=true` returns **every** city, sorted
`isPopular desc, name asc`. The frontend does the popular/tier-2 grouping itself off the `isPopular`
field already on `CityDto` — no second endpoint/shape needed for "the tier-2 list" specifically.

## Shared icon map (`packages/types/src/cityIcons.ts`, new)

`CITY_ICONS: Record<string, string>` — one distinct emoji per all 37 cities (e.g. Bengaluru 💻,
Jaipur 🏰, Kochi ⚓, Nagpur 🍊, Amritsar 🙏, Panaji 🏝️) plus `getCityIcon(name)` falling back to a
generic 📍. New `./cityIcons` subpath export on `@bhavano/types`. Reused by both apps, same
reasoning as `categoryImagePlaceholder` living in `packages/types/src/tokens.ts`.

## Web (`LocationPicker.tsx`, `lib/bff.ts`, `app/actions/locations.ts`)

- `fetchCities` gained an `all` flag; new `listAllCitiesAction()` server action.
- Every city row now renders `{getCityIcon(c.name)} {c.name}`.
- A "Show more cities" button (shown only when not actively searching) lazily fetches all 37 cities
  and re-renders the list split into **Popular** / **More cities** sections — collapses back to the
  plain popular list the moment a search query is typed, since search already matches any city
  regardless of tier.

## Mobile (`HomeSheetsProvider.tsx`, `lib/bffClient.ts`)

Same shape of change: `fetchCities` gained the `all` param; the location bottom sheet's city list
renders the icon per row and gained a "Show more cities" `Pressable` that fetches and re-renders
with the same Popular/More-cities split. No versioned Expo API was touched (plain
`Text`/`Pressable`/state), so no Expo-docs check was needed for this change.

## Verification performed

- `pnpm --filter @bhavano/types build && pnpm typecheck` — all 5 packages pass.
- Ran `npx prisma db seed`: the city/area upsert loops (which run before the seed-owner's demo
  listings are recreated) completed successfully, then the script hit an unrelated **pre-existing
  bug**: `prisma.listing.deleteMany({where:{ownerId: owner.id}})` fails with a foreign-key
  violation against `ListingView`, since that model (added earlier this session for the admin
  logins/activity feature) has no cascade delete. This blocks a full `prisma db seed` run
  end-to-end but doesn't affect this change — confirmed via direct API queries that every
  city/area upsert had already committed before the crash. Worth fixing separately if a full
  re-seed is ever needed; left out of scope here.
- Rebuilt/restarted the BFF and confirmed via `curl`: `GET /locations/cities?all=true` returns 37
  cities (12 popular + 25 tier-2); spot-checked areas for Jaipur (9), Kochi (9), Chandigarh (9),
  Panaji (5), Guwahati (6) — all present.
- Confirmed the web app's own request log shows a real `listAllCitiesAction()` invocation
  succeeding from an actual browser interaction (the "Show more cities" flow), and that `/` and
  `/bengaluru` still render 200 after the `LocationPicker.tsx` rewrite.
