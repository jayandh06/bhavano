# Google Maps: location picker, reverse geocoding, and display

## Context

Bhavano currently locates a listing purely by a categorical City/Area hierarchy the poster picks
from a dropdown (City) plus a free-text-with-autocomplete field (Area). There is no street
address anywhere in the product, and no per-listing precise coordinate is ever collected in
practice. This plan adds a Google Maps pin picker to the posting flow (web + mobile) so a seller
can drop a pin on their actual property/store, auto-derive City/Area from that pin via reverse
geocoding, and show buyers a map on the listing detail page — with an explicit decision on how
precise that public-facing pin should be, since this is the first time the product would ever
expose anything more precise than "Area, City" text.

### How address is maintained today (confirmed by reading the code)

- `Listing` (`apps/bff/prisma/schema.prisma:153-171`) has a **required** `areaId` → `Area` and
  `cityId` → `City` relation. It also has optional `lat`/`lng` `Float?` columns on the table —
  but these are dead weight: absent from `CreateListingDto`
  (`apps/bff/src/listings/dto/create-listing.dto.ts`), `CreateListingInput`, and
  `ListingDetailDto` (`packages/types/src/index.ts`). Nothing ever writes or reads them today.
  There is no free-text street-address field at all, on the schema or in any DTO.
- `City` (`schema.prisma:88-101`) has **required** `lat`/`lng` (a city centroid) and an
  `isPopular` flag. It's a small, curated, finite table — nothing in the app creates a City
  dynamically today.
- `Area` (`schema.prisma:103-116`) has **optional** `lat`/`lng` and a `source` discriminator
  (`'curated'` vs `'user-submitted'`). Seed-curated areas have a rough hand-typed centroid
  (`apps/bff/prisma/seedCities.ts` — approximations "sourced from general knowledge," not real
  geocoded data); areas created at posting time via `ensureArea` get `lat: null, lng: null`.
- Posting flow: `PostAdWizard.tsx` (web: `apps/web/src/components/home/PostAdWizard.tsx`,
  mirrored in `apps/mobile/src/components/home/PostAdWizard.tsx`) collects `cityId` from a
  `<select>`, and an area name typed into an autocomplete box backed by
  `GET /locations/areas?cityId=&q=`. A case-insensitive match sends `areaId`; otherwise the raw
  text is sent as `areaName` with a "will be added as a new area" note (web
  `PostAdWizard.tsx:346-349`). No map, no address field, no coordinate capture anywhere.
- Server side, `ListingsService.create()` (`apps/bff/src/listings/listings.service.ts:333`) does
  `input.areaId ?? (await this.locationsService.ensureArea(input.cityId, input.areaName)).id`.
  `ensureArea` (`apps/bff/src/locations/locations.service.ts`) case-insensitively matches an
  existing Area under that City or creates one with `source: 'user-submitted'` and null coords —
  already shared with `SavedSearchesService`, a stable, low-risk reuse point for this plan.
- `LocationsService.reverseGeocode(lat, lng)` (same file) is **not** Google-based — it's a pure
  in-memory haversine nearest-city scan over the curated `City` table (`GET /locations/reverse`),
  used only by the homepage's "auto-detect my location" button. It stays exactly as-is; a new,
  real Google-backed reverse-geocode path is added alongside it for the posting flow.
- Display: `ListingDetailView.tsx:109` renders only `📍 {area}, {city}` as plain text — no map
  rendered anywhere in the product today, web, mobile, or admin.
- No Google Maps/Places/Mapbox/Leaflet/react-native-maps/expo-maps dependency exists anywhere in
  the repo. `apps/bff` depends on `google-auth-library`, but that backs Google **OAuth login**
  (`apps/bff/src/auth/providers/google.provider.ts`, using `GOOGLE_CLIENT_ID`) — an unrelated
  Google Identity credential, not Google Maps Platform; must not be reused or conflated with the
  new Maps API keys.
- `apps/mobile` already depends on `expo-dev-client` and `expo-location` (compatible with
  `react-native-maps`); `apps/mobile/AGENTS.md` only says Expo 57 has changed enough that its
  docs should be (re-)read before writing code — no existing guidance on which map library to use.
- Established third-party-script convention: `apps/web/src/lib/razorpay.ts`'s
  `loadRazorpayScript()` — a small promise-based loader that injects a `<script>` tag and resolves
  once the vendor's global (`window.Razorpay`) is available, reused as-is by `BoostButton.tsx`
  and `SubscribeButton.tsx`. This plan mirrors that for Google Maps JS API loading on web instead
  of adding a heavier wrapper dependency like `@react-google-maps/api`.
- Dead code worth resolving as part of this work: `packages/types/src/index.ts:42-59` has a
  `GeoPoint` interface and a `Listing` interface with `location: GeoPoint` that doesn't match any
  real Prisma-backed DTO (`ListingCardDto`/`ListingDetailDto` never carry a `location` field like
  this — confirmed unused anywhere in the app via a full grep). This looks like an early sketch
  superseded by the City/Area model and never deleted. Repoint it to describe the new `lat`/`lng`
  pin (or delete it) so there's one source of truth for "what a location looks like," not two.

This confirms the premise: address today is coarse (City + Area category, no street-level data),
and the existing `lat`/`lng` columns are schema-only ambition that was never wired up. Adding a
real pin is a net-new capability, not a fix to something broken.

---

## Proposed Design

### 1. Schema / DTO changes (shared groundwork for picker + display)

- Reuse the existing `Listing.lat`/`Listing.lng` `Float?` columns — no migration needed.
- Add `lat?: number; lng?: number` to `CreateListingDto` with `@IsOptional()` plus numeric-range
  validation (class-validator's `@IsNumber()` + `@Min(-90)/@Max(90)` for lat, `@Min(-180)/@Max(180)`
  for lng — confirm at implementation time whether class-validator's dedicated `@IsLatitude()`/
  `@IsLongitude()` decorators are available in the installed version, else use the generic form).
  Keep optional at the DTO level (not hard-required) so a "skip the map" path stays possible for
  spotty connectivity — this is a soft default, revisit if product wants to force it later.
- Add the same fields to `CreateListingInput` and `ListingDetailDto` in `packages/types/src/index.ts`,
  and wire `ListingsService.create()`/`toDetailDto()` to persist and return them.
- Resolve the dead `GeoPoint`/`Listing.location` shape noted above as part of this change.

### 2. New BFF endpoint: server-side reverse geocoding

- Add `POST /locations/reverse-geocode` (distinct from the existing `GET /locations/reverse`,
  which stays untouched) to `LocationsController`/`LocationsService`.
- Server calls Google's Geocoding API using a **server-side, IP-restricted** API key — never
  ship a geocoding-capable key to the browser/app. Same client/server credential split the team
  already applies to Razorpay (`RAZORPAY_KEY_ID` sent to client, `RAZORPAY_KEY_SECRET`
  server-only); document the same way in `apps/bff/.env.example`.
- From Google's response, extract the `locality` (and `sublocality`/`sublocality_level_1` as a
  secondary signal) address components.
- **City resolution: match-only, never auto-create.** Look up the resolved locality name against
  the existing `City` table. If found, return that `cityId`; if not found, tell the user plainly
  that Bhavano isn't live in that city yet rather than creating one. City is load-bearing for SEO
  URL structure and routing and is deliberately kept small/curated — auto-creating from arbitrary
  geocoded input risks polluting it with typos or a mis-dropped pin in an unsupported city, in a
  way that's much harder to clean up than an extra Area row.
- **Area resolution: auto-create via the existing hook.** Once a City match is found, call
  `LocationsService.ensureArea(cityId, resolvedLocalityOrSublocalityName)` directly — already
  implements exactly the needed match-or-create semantics, no new logic required.
- Response shape: `{ cityId: string | null, areaId: string | null, formattedAddress: string,
  resolvedLocality: string }` — the client always shows this as an editable suggestion, never
  auto-locks the City/Area selects, since Google's boundaries won't line up perfectly with
  Bhavano's own Area granularity (expected mismatch, not a bug).

### 3. Posting-flow UI: web (`PostAdWizard.tsx`)

- Add a location step with a Places Autocomplete search box (search by address/landmark, jump
  the map there) plus an interactive map (Google Maps JavaScript API) with a draggable marker,
  defaulting to the city centroid if no address has been searched yet.
- Load via a new `apps/web/src/lib/googleMaps.ts`, mirroring `loadRazorpayScript()`'s exact
  pattern: inject `<script src="https://maps.googleapis.com/maps/api/js?key=...&libraries=places&loading=async">`,
  resolve once `window.google.maps` exists — no `@react-google-maps/api` wrapper dependency.
- On marker drop/drag-end, call `POST /locations/reverse-geocode` (never Google directly from the
  browser) and pre-fill City (select) + Area (autocomplete box) as an editable suggestion.
- Persist the dropped pin's raw `lat`/`lng` regardless of whether the City/Area suggestion is
  accepted or overridden.

### 4. Posting-flow UI: mobile (`apps/mobile/src/components/home/PostAdWizard.tsx`)

- Use `react-native-maps` for the interactive map: mature, well-documented, works with
  `expo-dev-client` (already a dependency) via a config plugin. (`expo-maps` is a lighter-weight,
  more "Expo-native" alternative but comparatively new — worth a short spike to compare before
  committing, but default to `react-native-maps` unless that spike says otherwise.)
- Places Autocomplete on mobile: a direct `fetch` to the Places Autocomplete REST endpoint (keeps
  dependency footprint minimal, consistent with "just call the vendor's API"), or an existing
  community RN component if it saves meaningful time — a build-vs-borrow call for implementation.
- Requires a **separate native Google Maps SDK API key** for Android (and iOS if targeted),
  configured in `apps/mobile/app.json`'s `android.config.googleMaps.apiKey` — distinct from the
  web JS key and the server-side geocoding key. `expo-location` (already a dependency) can supply
  "use my current location" as a map starting point, complementing the pin-drop/search flow.
- Same reverse-geocode call to the BFF endpoint on pin placement, same editable-suggestion
  behavior as web.

### 5. Display side: listing detail page — public pin is jittered/snapped, not exact

**Decision (confirmed):** the public listing detail page shows an **approximate** location, not
the seller's exact pin — snapped to the Area centroid or randomized within roughly 100-200m of
the real pin. The precise `lat`/`lng` is still stored and used internally (e.g. only ever
revealed once a buyer/seller actually connect via chat, if that's built later), but never
rendered directly on the public page. This applies uniformly across categories (not just
residential) for this pass, to keep the first implementation simple — category-gated exactness
(showing precise pins for commercial/plot/coworking, jittered for residential) is a reasonable
future refinement but not required for launch.

- Use Google's **Static Maps API** (a plain `<img>`, server-renderable, cacheable, no JS SDK) for
  `ListingDetailView.tsx`'s map — not the interactive JS Maps API. Static Maps costs roughly a
  third of dynamic Maps JS API loads (see cost estimate below), and this page is by far the
  highest-traffic surface in the product, so cost here scales with page *views*, not once per
  listing the way the posting flow does.
- The BFF (not the client) computes the jittered/snapped point server-side before it ever reaches
  `ListingDetailDto`, so the precise pin never round-trips to the browser at all for anonymous
  viewers.

---

## Cost Estimate (Google Maps Platform)

Google gives a recurring **~$200/month** free credit against Maps Platform usage account-wide
(this program's structure has changed before — re-verify against Google's current pricing page
at implementation time, don't treat this plan's numbers as fact).

Rough current per-1,000-unit prices (verify at implementation time — pricing drifts):

| API | Rough cost / 1,000 calls | Where it's used |
|---|---|---|
| Maps JavaScript API (dynamic) | ~$7 | Posting flow only (web interactive map) |
| Places Autocomplete (per session) | ~$2.83 | Posting flow only (address search, web + mobile) |
| Geocoding API | ~$5 | One call per listing post (reverse-geocode on pin-drop) |
| Static Maps API | ~$2 | Listing-detail-page views (display side) |

**Illustrative scenario** (order-of-magnitude reasoning, not a forecast):
- ~300 new posts/day → ~9,000 posts/month, each touching the map once (JS load + one Autocomplete
  session + one Geocoding call): 9,000 × (~$7 + ~$2.83 + ~$5)/1,000 ≈ **$134/month** for the
  entire posting-flow side.
- Listing-detail-page views typically run 10-50x higher than posts. At ~150,000 views/month,
  Static Maps: 150,000 × ~$2/1,000 ≈ **$300/month** — vs. ~$1,050/month if the same views used
  the dynamic Maps JS API instead, which is why Static Maps matters specifically for display.
- Net: roughly **$400-450/month** before the ~$200 free credit, i.e. **~$200-250/month net**
  under this illustrative scenario — dominated by listing-page-view volume, not posting volume.
  Re-model against Bhavano's actual traffic before committing, and check Google's official
  pricing calculator directly since these figures will drift.

---

## Feasibility Answer: Can City/Area Be Auto-Derived From the Map Pin?

**Yes for Area, "match-only" for City** — asymmetric by design:

- **Area: yes, auto-derive and auto-create.** `LocationsService.ensureArea(cityId, name)`
  already exists, is already shared across two features, and already implements exactly the
  right semantics (case-insensitive match-or-create scoped to a city). Feeding it Google's
  resolved locality/sublocality name on pin-drop is a direct, low-risk reuse.
- **City: match against the existing curated table only, never auto-create.** City is
  structurally load-bearing (SEO URLs, routing, the popular-cities feature) and deliberately kept
  small/curated — nothing else in the codebase creates a City dynamically. If the resolved
  locality doesn't match an existing City, surface that directly ("Bhavano doesn't support this
  city yet") rather than silently creating a placeholder.
- In both cases, the result is a **suggestion the user can override**, never an auto-locked
  field — Google's boundaries won't line up perfectly with Bhavano's own curation, and this
  mismatch is expected, not a bug.

---

## Critical Files for Implementation

- `apps/bff/prisma/schema.prisma` — `Listing.lat`/`lng` already exist; no migration needed.
- `apps/bff/src/listings/dto/create-listing.dto.ts` and `packages/types/src/index.ts`
  (`CreateListingInput`, `ListingDetailDto`, and the dead `GeoPoint`/`Listing.location` shape to
  resolve) — wire `lat`/`lng` through the DTO layer.
- `apps/bff/src/locations/locations.service.ts` and `locations.controller.ts` — add the new
  `POST /locations/reverse-geocode` server-side Google Geocoding call; reuse `ensureArea()`
  as-is; leave the existing haversine `reverseGeocode()`/`GET /locations/reverse` untouched.
- `apps/bff/src/listings/listings.service.ts` (`create()`, `toDetailDto()`) — persist/return
  `lat`/`lng`, and compute the jittered/snapped public point before building `ListingDetailDto`.
- `apps/web/src/components/home/PostAdWizard.tsx` + new `apps/web/src/lib/googleMaps.ts`
  (mirroring `apps/web/src/lib/razorpay.ts`) — the web pin picker + Places Autocomplete.
- `apps/mobile/src/components/home/PostAdWizard.tsx` + `apps/mobile/app.json` (native Google Maps
  SDK key slot) — the mobile pin picker via `react-native-maps`.
- `apps/web/src/components/home/ListingDetailView.tsx:109` — replace the plain-text
  `📍 {area}, {city}` with a Static Maps `<img>` of the jittered/snapped point.
- `apps/bff/.env.example` (and web/mobile env files) — three new, distinct API keys: web JS key
  (HTTP-referrer restricted), server-side Geocoding/Places key (IP-restricted, never sent to any
  client), native Android Maps SDK key — all separate from the existing
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` OAuth-login credential.

---

## Verification

- `pnpm -w typecheck` after the new DTO/type fields land.
- Manual: post a test ad on web, drop a pin, confirm City/Area auto-suggest correctly and remain
  editable; confirm the listing's stored `lat`/`lng` matches the dropped pin.
- Manual: repeat on mobile once `react-native-maps` is wired in.
- Confirm the listing detail page's Static Map image shows a point offset from the true stored
  pin (the jitter/snap working), never the exact coordinate, for an anonymous/logged-out viewer.
- Confirm dropping a pin in a city Bhavano doesn't support surfaces the "not supported here"
  message rather than silently creating a new City row.

---

## Explicitly Out of Scope

- Redesigning the City/Area curation system itself (how new cities get added, admin tooling for
  curating areas) — this only adds a match/auto-create hook on top of what exists.
- Any changes to `apps/admin`.
- Locking in `react-native-maps` vs. `expo-maps` with certainty — a recommended default is given,
  with a short spike suggested before committing.
- Revealing the precise pin to a connected buyer/seller after contact (e.g. inside a chat
  thread) — flagged as a natural future extension, not built in this pass.
- Making `lat`/`lng` a hard-required field on posting (vs. staying optional) — kept optional as a
  soft default; revisit if product wants to force it.
