# Mandatory listing fields + price-qualifier dropdown

## Context

Today the posting wizard (`apps/web`, `apps/mobile`) and the BFF's `CreateListingDto` treat
almost everything beyond price/title/city/area as optional: photo upload is explicitly labeled
"(optional)", category-specific attributes (bedrooms, bathrooms, sqft, sharing type, etc.) have no
required flag at all, and `priceQualifier` is a freeform text input with no validation — sellers
can type anything or leave it blank. This lets listings go live with no photo and missing details
that buyers actually need (e.g. a house listing with no bedroom count), and lets `priceQualifier`
drift into inconsistent free text ("/month", "per month", "monthly", etc.).

This change makes photo + a per-category set of "core" attributes mandatory at posting time, and
turns `priceQualifier` into a constrained dropdown whose options depend on category + transaction
type, enforced both in the UI (so users get immediate feedback) and in the BFF (so the API itself
never accepts an incomplete/invalid listing, regardless of client).

**Confirmed scope (from user):**
- Price qualifier: always a required dropdown selection. For `sell` transactions it includes a
  neutral "Fixed price" option (submits as blank, matching today's seed data for sell listings).
  For `rent`/`lease` there's no blank option — a unit (e.g. "/month") must be picked.
- Mandatory category attributes: residential (house/apartment) → bedrooms, bathrooms, sqft. Plus
  one core field per other category: PG → sharing type; storage → size (sqft); coworking → seat
  type; furniture → condition. Everything else (furnishing, meals, amenities, material, brand,
  dimensions, gender) stays optional.
- At least one photo is required for every category.

## Data model / shared config changes

**`packages/types/src/categoryFields.ts`** — added `required?: boolean` to `FieldDef`, and set it
on: `bedrooms`, `bathrooms`, `sqft` (residential); `sharingType` (pg); `sizeSqft` (storage);
`seatType` (coworking); `condition` (furniture). This stays the single source of truth the wizard,
edit form, and BFF all read from — no duplicated required-field lists.

**New `packages/types/src/priceQualifiers.ts`** — mirrors `postingRules.ts`'s pattern:
```ts
export interface PriceQualifierOption { value: string; label: string; }

export const PRICE_QUALIFIER_OPTIONS: Record<ListingCategory, Partial<Record<TransactionType, PriceQualifierOption[]>>> = {
  house:      { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
  apartment:  { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
  pg:         { rent: MONTHLY_OPTIONS },
  storage:    { rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
  coworking:  { rent: COWORKING_RENT_OPTIONS, lease: COWORKING_RENT_OPTIONS },
  furniture:  { sell: SELL_OPTIONS, rent: FURNITURE_RENT_OPTIONS },
};
```
- `SELL_OPTIONS`: `{value:"", label:"Fixed price"}`, `{value:"onwards", label:"Onwards"}`,
  `{value:"negotiable", label:"Negotiable"}`
- `MONTHLY_OPTIONS`: `{value:"/month", label:"Per month"}`
- `COWORKING_RENT_OPTIONS`: `{value:"/seat/month", label:"Per seat / month"}`,
  `{value:"/month", label:"Per month (whole space)"}`
- `FURNITURE_RENT_OPTIONS`: `{value:"/day", label:"Per day"}`, `{value:"/month", label:"Per month"}`

`getPriceQualifierOptions(category, transactionType)` returns the array (`[]` defensively).
`packages/types/package.json` gained a `./priceQualifiers` subpath export alongside the existing
`./categoryFields`/`./postingRules` ones.

## Backend (`apps/bff/src/listings/listings.service.ts`)

Two private helpers, backed directly by the shared config (no duplicated rules):
- `assertRequiredAttributes(category, attributes)` — throws `BadRequestException` naming the
  missing field for any `CATEGORY_FIELD_CONFIG[category]` entry with `required: true` that's
  absent/empty in `attributes`.
- `assertValidPriceQualifier(category, transactionType, priceQualifier)` — throws
  `BadRequestException` unless the value is one of `getPriceQualifierOptions(...)`.

`create()` calls both plus a photo check (`input.photos?.length`) up front, before moderation.
`update()` calls the same two checks against the listing's existing (immutable)
`category`/`transactionType`, but only when the incoming `UpdateListingDto` actually sets
`attributes` / `priceQualifier` — so a status-only update (marking sold/rented) is never blocked
by unrelated missing fields on listings created before this change. DTOs themselves got no new
decorators — these are cross-field, category-dependent rules that class-validator can't express
cleanly, so validation stays in the service.

## Frontend — web (`apps/web/src/components/home/PostAdWizard.tsx`)

- Photo field uses `RequiredLabel`; `!!photoFile` is folded into `detailsValid`.
- Price qualifier is now a `<select>` sourced from `getPriceQualifierOptions(category,
  transactionType)`, wrapped in `RequiredLabel`. `selectCategory`/`selectTransactionType` reset
  `priceQualifier` to the first valid option whenever category or transaction type changes.
- Category attribute fields render `RequiredLabel` instead of a plain `label` when `field.required`.
- `detailsValid` also requires every `required` field in `CATEGORY_FIELD_CONFIG[category]` to be
  non-empty in `attributes`.

## Frontend — edit form (`apps/web/src/components/home/EditListingForm.tsx`)

Category/transactionType are read-only here, so the same required set applies:
- Price qualifier is a `<select>` using `getPriceQualifierOptions(listing.category,
  listing.transactionType)`. If the listing's stored value isn't in that fixed list (legacy
  free-text data from before this change), it's kept as an extra selectable "(current)" option
  instead of being silently dropped. The update payload now always sends `priceQualifier` (previously
  `priceQualifier || undefined` — a latent bug once `""` became a meaningful value: selecting "Fixed
  price" would have silently failed to overwrite a non-blank qualifier).
- Required attribute labels get a trailing `*`; `valid` also checks those attributes are non-empty.
- Photos aren't editable in this form (no photo UI exists here) — left out of scope; existing
  listings with zero photos aren't newly blocked from being edited.

## Frontend — mobile (`apps/mobile/src/components/home/PostAdWizard.tsx`)

Same three changes, adapted to the file's existing React Native patterns: price qualifier changed
from a `TextInput` to a chip-row of `Pressable` options (matching how `CATEGORY_FIELD_CONFIG`
selects already render there), required-field labels get a trailing `*`, and `detailsValid` gained
`!!photoUri` plus the same required-attributes check.

## Verification

- `pnpm --filter @bhavano/types build && pnpm typecheck` — all 5 packages pass.
- Web: run the wizard for each category — Review/Post stays disabled until photo + all
  category-required fields + a price-qualifier selection are set; a `sell` listing with "Fixed
  price" stores `priceQualifier: ""`; a `rent` listing can't be submitted without picking a
  qualifier.
- BFF: `POST /listings` with a photo-less body → 400; missing a required attribute for the
  category → 400; invalid `priceQualifier` for the category/transactionType → 400; a fully-valid
  body for each of the 6 categories → 201.
- Edit form: confirm the price-qualifier dropdown pre-selects the listing's current value, and
  that Save is blocked if a required attribute is cleared.
