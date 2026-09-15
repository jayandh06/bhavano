# Admin: edit Area, City, map location, Category, and Transaction Type

## Context

Admin's listing edit form (`AdminEditListingForm.tsx`) currently only lets an admin change
price/priceQualifier/title/description/specs/attributes/status — Area, City, map pin (lat/lng),
Category, and Transaction Type are creation-time-only, both in the UI (no inputs exist) and in
the backend (`UpdateListingDto` doesn't declare these fields, so a whitelisting `ValidationPipe`
strips them even if sent). This is a gap, not a deliberate lock: no comment or business rule
forbids editing them, they were simply never wired past creation. Admins need this for support
cases — a listing posted under the wrong city/category, a seller's typo'd location, a dropped pin
that's off — the same "fix it without asking the owner to redo the whole post" reasoning that
already justifies `updateAsAdmin`'s existing scope.

**Why this is safe to add now (the key research finding):** City/Area/Category/TransactionType are
baked into a listing's canonical SEO URL (`buildListingPath`,
`packages/types/src/listingPath.ts:23-28`: `/{citySlug}/{areaSlug}/{transactionGroup}/{category}/{slug}-{id}`),
but that URL is **never persisted** — it's recomputed fresh on every request from the DB row
looked up by the immutable listing `id`. `apps/web/src/app/[city]/[[...rest]]/page.tsx:426-433`
already 301-redirects any request whose path doesn't match the freshly-computed canonical path
(`buildListingPath(listing)`) to the correct one. So changing these fields on an existing listing
is **already transparently 301-redirected** with zero new redirect code — the same mechanism that
already handles a title edit changing the slug. No migration, no URL-history table needed.

The one real hazard is **Category/TransactionType coupling with `attributes`**: `assertValidAttributes`
(`listings.service.ts:1935`) throws on any attribute not valid for a (category, transactionType)
pair, and required fields differ per category. A bare category swap with the old attributes object
left in place will likely fail validation or silently carry nonsense fields (e.g. "bedrooms" on a
"plot" listing). The plan below resets attributes to the new category's defaults on a category
change, mirroring exactly what the posting wizard already does when a seller picks a category
(`defaultAttributesFor`, used in `PostAdWizard.tsx:222`).

**Scope decision (confirmed):** the map-location editor is plain Lat/Lng number inputs plus a
"View on Google Maps ↗" link (`https://www.google.com/maps?q={lat},{lng}`) — not a ported
interactive draggable-pin map. That avoids a new Google Maps JS API key, script loader, and
Tailwind-free reimplementation of `LocationMapPicker` for what is an infrequent admin correction.

---

## Backend (`apps/bff`)

No Prisma migration needed — `category`, `transactionType`, `cityId`, `areaId`, `lat`, `lng` all
already exist on `Listing` (`apps/bff/prisma/schema.prisma:317-343`).

### 1. New `AdminUpdateListingDto`

In `apps/bff/src/listings/dto/update-listing.dto.ts`, add a subclass used only by the admin route:

```ts
export class AdminUpdateListingDto extends UpdateListingDto {
  @IsOptional() @IsIn(LISTING_CATEGORIES) category?: ListingCategory;
  @IsOptional() @IsIn(TRANSACTION_TYPES) transactionType?: TransactionType;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) areaName?: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
}
```
(`LISTING_CATEGORIES`/`TRANSACTION_TYPES` arrays and `@IsLatitude`/`@IsLongitude` decorators
already exist in `create-listing.dto.ts` — reuse the same constants/import style.)

Keeping this on a **subclass used only by the admin controller** — not added to the base
`UpdateListingDto` that the owner-facing route also uses — is the actual security boundary: the
owner's `PATCH /listings/:id` (`listings.controller.ts:98`) keeps binding to plain
`UpdateListingDto`, so Nest's global `whitelist: true` `ValidationPipe` (`main.ts:17`) strips these
fields from any owner request before it reaches the service. No new guard logic needed — owners
still cannot self-edit these fields.

### 2. `admin.controller.ts` — widen the PATCH body type

`apps/bff/src/admin/admin.controller.ts`'s `@Patch('listings/:id')` handler: change
`@Body() dto: UpdateListingDto` → `@Body() dto: AdminUpdateListingDto`. `AdminService.updateListing`
and `ListingsService.updateAsAdmin` widen their `dto` parameter type the same way (a plain
`UpdateListingDto` object still structurally satisfies `AdminUpdateListingDto` since all the new
fields are optional, so `ListingsService.update`'s owner call site needs no change).

### 3. `ListingsService.applyUpdate` — the real logic

In `apps/bff/src/listings/listings.service.ts` (private `applyUpdate`, currently lines 1555-1635):

- Compute `nextCategory = dto.category ?? existing.category`, `nextTransactionType = dto.transactionType ?? existing.transactionType`, `categoryOrTxnChanged = nextCategory !== existing.category || nextTransactionType !== existing.transactionType`.
- **Attributes**: `const attrsToValidate = dto.attributes ?? (categoryOrTxnChanged ? defaultAttributesFor(nextCategory) : existing.attributes)`. Call `assertValidAttributes(nextCategory, nextTransactionType, attrsToValidate)` whenever `dto.attributes !== undefined || categoryOrTxnChanged`. Import `defaultAttributesFor` from `@bhavano/types/categoryFields` (already imported elsewhere in this file — see `CATEGORY_FIELD_CONFIG` import at line 37).
- **Price/priceQualifier**: re-run `assertValidPriceQualifier`/`assertValidPrice` against `nextCategory`/`nextTransactionType` whenever `dto.priceQualifier`/`dto.price` is given **or** `categoryOrTxnChanged` (falling back to `existing.priceQualifier`/`existing.price` as the value under test) — a category swap can flip whether the existing price/qualifier is still legal (e.g. "Contact for price" no longer allowed).
- **City/Area resolution**: if any of `dto.cityId`/`dto.areaId`/`dto.areaName` are present:
  - `const nextCityId = dto.cityId ?? existing.cityId`.
  - If `dto.areaId` given: look up `this.prisma.area.findUnique({ where: { id: dto.areaId } })`, throw `BadRequestException` if missing or `area.cityId !== nextCityId` (guards against picking an area from the wrong city).
  - Else if `dto.areaName` given: `nextAreaId = (await this.locationsService.ensureArea(nextCityId, dto.areaName)).id` (identical to `create()`'s own resolution at `listings.service.ts:1011-1013`).
  - Else if `dto.cityId` given but neither area field is: throw `BadRequestException('areaId or areaName is required when changing city')` — city and area must move together.
- Extend the Prisma `data` object (lines 1579-1608) with conditional entries for `category`, `transactionType`, `cityId` (only if it actually changed), `areaId` (only if it actually changed), `lat`, `lng`, and swap the existing `attributes` branch to use `attrsToValidate` whenever `dto.attributes !== undefined || categoryOrTxnChanged`.
- Extend `diffFields`'s two object literals (lines 1611-1628) to also include `category`, `transactionType`, `cityId`, `areaId`, `lat`, `lng` — `diffFields` itself is generic, no change needed there.

### 4. `ListingDetailDto` / `toDetailDto` — expose what the edit form needs to pre-fill

In `packages/types/src/index.ts`, add to `ListingDetailDto`:
```ts
cityId: string;
areaId: string;
/** Unjittered — only present for the owner or an admin. See jitteredLocation's own doc comment
 * for why the public `lat`/`lng` on this DTO are always an approximation. */
exactLat?: number;
exactLng?: number;
```
In `toDetailDto` (`listings.service.ts:2142`), add `cityId: listing.cityId, areaId: listing.areaId,`
unconditionally (not sensitive — the name-based `area`/`cityName` fields are already public), and
`exactLat: isOwnerOrAdmin ? listing.lat ?? undefined : undefined` (same for `exactLng`) — same
gating pattern already used for `videoEntitlement`/`renewalHistory` in this method. The existing
`...this.jitteredLocation(listing)` spread for the public `lat`/`lng` fields is untouched.

### 5. `docs/plans/listing-edit-history.md`

Update the "What's tracked" bullet to add `category, transactionType, cityId, areaId, lat, lng`
to the enumerated diffed fields, per this repo's convention of keeping plan docs in sync with
landed behavior.

### 6. `docs/plans/google-maps-location-picker.md`

That plan's "Explicitly Out of Scope" list says "Any changes to `apps/admin`" — add a note that
this is now superseded by this change for the specific case of an admin correcting a listing's
pin/city/area/category after the fact (the public-facing jitter/display behavior it describes is
untouched).

---

## Frontend (`apps/admin`)

### 1. `apps/admin/src/lib/bff.ts`

- Extend `updateListingAsAdmin`'s `input` type (lines 224-240) with the new optional fields:
  `category?, transactionType?, cityId?, areaId?, areaName?, lat?, lng?`.
- `fetchCities`/`fetchAreas` (lines 164-176) already exist and already support `all=true` for an
  uncapped list — reuse as-is, no change needed.

### 2. `apps/admin/src/app/actions/admin.ts`

Extend `updateListingAction`'s `input` type (lines 93-102) to match.

### 3. New `apps/admin/src/app/actions/locations.ts`

Thin server-action wrappers (mirroring the shape of other files in this directory) around
`fetchCities`/`fetchAreas` from `bff.ts`, gated through `requireAdmin()` for consistency with every
other admin action even though the underlying BFF routes carry no auth guard themselves:
```ts
export async function fetchCitiesAction() { await requireAdmin(); return fetchCities(undefined, true); }
export async function fetchAreasForCityAction(cityId: string) { await requireAdmin(); return fetchAreas(cityId, undefined, true); }
```

### 4. `apps/admin/src/app/listings/[id]/edit/page.tsx`

Fetch the city list server-side (`fetchCitiesAction()`) alongside the existing `fetchListingById`
call, and pass it as a new `cities` prop to `AdminEditListingForm`.

### 5. `AdminEditListingForm.tsx` — the bulk of the UI work

- Turn `category`/`transactionType` (currently derived `const`s off the `listing` prop, lines
  389-390) into `useState`, seeded from `listing.category`/`listing.transactionType`.
- **Category select**: a `<SelectField>` populated from `POST_CATEGORIES` (`@bhavano/types/postCategories`
  — flat `{value, label, iconName}` list, already used by the web posting wizard, pure data with
  no Tailwind/DOM dependency). On change: reset `attributes` to `defaultAttributesFor(newCategory)`
  (`@bhavano/types/categoryFields`, same reset the posting wizard performs), and if the current
  `transactionType` isn't in `POSTABLE_TRANSACTION_TYPES[newCategory]` (`@bhavano/types/postingRules`),
  snap it to that list's first entry. Also re-run the existing `priceQualifierChoices` fallback
  logic already in this component (lines 428-434) — since `category`/`transactionType` become
  reactive state, this recomputes automatically; additionally snap `priceQualifier` to the new
  pairing's first valid option if the current value isn't in `getPriceQualifierOptions(newCategory, newTransactionType)`,
  so `assertValidPriceQualifier` can't reject the save.
- **Transaction type select**: a `<SelectField>` whose options are `POSTABLE_TRANSACTION_TYPES[category]`.
- **City select**: `<SelectField>` from the new `cities` prop, state `cityId` seeded from the new
  `listing.cityId` DTO field. On change: clear `areaId`/`areaName` state and call
  `fetchAreasForCityAction(newCityId)` to repopulate the area list.
- **Area select**: `<SelectField>` of areas for the current city (state `areas: Area[]`, fetched on
  mount for `listing.cityId` and refetched on city change), state `areaId` seeded from
  `listing.areaId`, plus an "Other (type a new area)" option that reveals a plain text input
  (`areaName` state) — mirrors `ensureArea`'s find-or-create semantics without a new debounced
  autocomplete component (none exists in `apps/admin` today, and this is a low-frequency
  correction, not the posting flow).
- **Lat/Lng**: two plain number inputs (own change handlers, not reusing the integer-only
  `sanitizeNonNegative`/`clampDigits` helpers built for attribute fields), seeded from the new
  `listing.exactLat`/`listing.exactLng` DTO fields (blank if unset). Client-side range validation
  (-90..90 / -180..180) folds into the existing `valid` boolean. When both are filled, show
  `<a href="https://www.google.com/maps?q={lat},{lng}" target="_blank">View on Google Maps ↗</a>`.
  A "Clear pin" button blanks both (sent as omitted from the payload, so the server-side jitter
  falls back to the area centroid exactly as it does for a listing that never had a pin).
- `onSave`: include `category`, `transactionType`, `cityId`, and whichever of `areaId`/`areaName`
  is active, plus `lat`/`lng` only when both are filled, in the `updateListingAction` payload.
- `valid`: also require a city and an area to be selected, and lat/lng to be either both blank or
  both in range.

No changes needed to `apps/admin/src/app/listings/[id]/page.tsx`'s History section — `diffFields`/
`logEdit` are generic over field names, so the newly-diffed fields appear there automatically once
`applyUpdate` includes them (per Backend §3).

---

## Verification

- `pnpm --filter bff typecheck` / `build`, `pnpm --filter admin typecheck` / `build`, `pnpm -w typecheck` (touches `packages/types`).
- Manually edit a test listing's City+Area to a different real city/area, save, confirm the row updates and the admin detail page reflects it.
- Manually change Category (e.g. apartment → plot): confirm the attributes editor resets to plot's fields with defaults, price/qualifier rules adjust (plot is sell-only, no "Contact for price"), Save is blocked until required fields are filled, and after saving, the listing's public detail page on `apps/web` renders correctly under the new category.
- Confirm a bookmarked/old URL for an edited listing still resolves and 301-redirects to the new canonical path (via the existing `apps/web/src/app/[city]/[[...rest]]/page.tsx` redirect — no new code, but this is the crux of the SEO-safety argument and should be checked end-to-end).
- Edit lat/lng, confirm the "View on Google Maps" link opens the right pin, and confirm the public listing detail page's static map still shows a jittered point afterward (never the exact one).
- Confirm the admin listing detail page's History section shows the new field changes with correct before/after values.
- Confirm a non-admin PATCH to `/listings/:id` with `category`/`cityId`/etc. in the body still has them silently stripped (owners still cannot self-edit these fields).
