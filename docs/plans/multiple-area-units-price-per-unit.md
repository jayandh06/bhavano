# Multiple area units + price-per-unit for Plot and Commercial listings

## Context

Today every area-bearing field (`carpetAreaSqft` for house/apartment/villa, `sizeSqft` for
storage, `plotAreaSqft` for plot, `sqft` for commercial — see `packages/types/src/
categoryFields.ts`) is a plain number hardcoded to square feet, both in its label text and in
`cardSpecs.ts`'s chip suffix. There's no `unit` concept anywhere in `FieldDef`. Price is a plain
`Int` rupee total (`Listing.price`) with a free-string `priceQualifier` (`Listing.priceQualifier`)
that only ever expresses *rental cadence* ("/month", "/week", "onwards") — never a per-area-unit
price. For land/plot listings specifically, pricing "₹50,000/cent" or "₹5,000/sqft" instead of a
lump sum, and describing a residential plot's site dimensions ("30×40 ft") rather than a bare area
number, are both standard Indian real-estate conventions this app can't express at all right now.

**Confirmed with the user:**
- Expanded unit picker (Sqft / Acres / Cents / Hectares / Sq m) — **Plot and Commercial only**.
  House/Apartment/Villa/Storage carpet/size fields stay Sqft-only, unchanged.
- "Whole price vs price per unit" toggle — **Sell and Lease only**. Rent keeps today's whole-price
  + `/month,/week,/day` cadence unchanged (combining a per-unit price with rental cadence is real
  added complexity, deliberately deferred).
- Optional plot **dimensions** field ("30 × 40 ft", free text) — **Plot only**, purely descriptive
  alongside the area value, not derived from or tied into the area calculation.

A reusable starting point already existed and wasn't connected to any of this: `apps/web/src/lib/
calculatorFormulas.ts` already defined `AreaUnit = "sqft" | "sqm" | "acre" | "hectare" | "cent"`
with conversion factors, for the standalone `/tools/area-unit-converter` SEO page. This plan
promotes that type (not the whole calculator) into `packages/types` so the BFF, web, and mobile
can all share one unit vocabulary.

## Key design decision: price is always stored as the whole-rupee total

`Listing.price` keeps meaning exactly what it means today — a directly comparable `Int` rupee
total — for every existing consumer: sorting (`price_asc`/`price_desc`), `minPrice`/`maxPrice`
search filters, `PRICE_BOUNDS` moderation sanity checks, boost pricing, admin tables. **None of
those need to change.** "Price per unit" becomes an *entry and display* preference, not a second
stored quantity:

- When a seller picks "Price per `<unit>`" and types e.g. ₹5,000, the client computes
  `price = round(perUnitPrice × areaValue)` and submits that as the normal `price` field, plus a
  new `priceUnit` flag recording which unit it was expressed in.
- At display time, if `priceUnit` is set, recompute `perUnitPrice = round(price / areaValue)` for
  display instead of storing it separately — same rounding trade-off this codebase already accepts
  elsewhere (`promoPriceFor`'s own doc comment: a little display-side rounding drift is the
  harmless direction). Keeps the schema to one new nullable column instead of two.
- If `priceUnit` is absent (the default, and every existing listing), display behaves exactly as
  today: the plain total, no unit suffix — "show whole price without unit" from the ask.

## Schema changes — `apps/bff/prisma/schema.prisma` + migration

- `Listing.priceUnit String?` (nullable, no default — absent = whole price). New dedicated column,
  mirroring `priceQualifier`'s own existing precedent (a column that modifies how `price` is
  interpreted/displayed, not a category-specific attribute) rather than living in `attributes`.
- **No new column for area units.** Area unit is category-specific data, so — consistent with
  every other category-specific field already living in the JSONB `attributes` column — it's a
  new sibling *attribute* key per area field, added only for plot/commercial. House/apartment/
  villa/storage need zero schema or migration involvement.
- **No new column for plot dimensions** — a plain new optional attribute key on the Plot category
  (`plotDimensions: string`), flowing through the existing generic `CATEGORY_FIELD_CONFIG`/
  `attributes` machinery with no bespoke plumbing at all.

Migration: `apps/bff/prisma/migrations/20260922112920_listing_price_unit/` — adds only
`ALTER TABLE "Listing" ADD COLUMN "priceUnit" TEXT;`.

## `FieldDef` gains an `"area"` field kind — `packages/types/src/categoryFields.ts`

Implemented as `FieldDef.type: "area"` plus a new `FieldDef.units?: AreaUnit[]` property. A field
with `units.length > 1` renders a number+dropdown; `units.length === 1` or `units` omitted renders
a plain number input, visually identical to before. `plot.plotAreaSqft` and `commercial.sqft` are
the only two fields with `units: ["sqft", "acre", "cent", "hectare", "sqm"]`. House/apartment/
villa/storage's area fields were left as plain `"number"` fields — zero visible change there.

- The area field's numeric value stays under its existing attribute key (`plotAreaSqft`/`sqft` —
  no rename, no migration, preserves every existing listing's data as-is); a new sibling key
  `${field.key}Unit` (`plotAreaSqftUnit`/`sqftUnit`) holds the chosen unit, defaulting to `"sqft"`
  whenever absent — covers every pre-existing listing with zero backfill.
- New optional Plot-only field: `plotDimensions` (plain text, e.g. `"30 x 40 ft"`), a normal
  `"text"` `FieldDef`, not required.
- `pruneHiddenAttributes` was updated: when an `area`-type field becomes hidden, it also deletes
  its sibling `${field.key}Unit` key (not called out in the original plan, needed once `units`
  became a real per-field concept).

## Shared area-unit vocabulary — new `packages/types/src/areaUnit.ts`

`AreaUnit`, `AREA_UNIT_LABELS`, `areaUnitShortLabel(unit, value)` (pluralization), `formatArea`,
`AREA_UNIT_TO_SQM` + `convertArea()` promoted out of `apps/web/src/lib/calculatorFormulas.ts` into
here; the web file now re-exports from there, so `/tools/area-unit-converter` is unaffected.

## Price-per-unit UI — post/edit forms (web, mobile, admin)

Implemented as planned: a "Total price" / "Price per `<unit>`" toggle next to the price input on
`sell`/`lease` listings whose category has an area field, `<unit>` always mirroring whichever unit
was picked for the area field. Landed in all five owning files: `apps/web/src/components/home/
PostAdWizard.tsx`/`EditListingForm.tsx`, `apps/mobile/src/components/home/PostAdWizard.tsx`/
`CategoryFieldsForm.tsx` (edit screen), `apps/admin/src/components/AdminEditListingForm.tsx`.

## Backend validation — `apps/bff/src/listings/listings.service.ts`

Implemented as `resolveListingPrice()` + `assertValidAreaUnit()`, called from both `create()` and
`applyUpdate()`. Rejects unless `transactionType` is `sell`/`lease`, the category has an area
field, the submitted unit is one of that field's allowed `units`, and it matches the area field's
own resolved unit. The *computed total* (not the per-unit figure) is what flows into the existing
`assertValidPrice`/`PRICE_ON_REQUEST_CATEGORIES` checks, unchanged.

One correctness point not spelled out in the original plan: on update, price is only ever
re-resolved when the request itself submits a new `dto.price` — never re-derived from
`existing.price` (already a stored total), to avoid double-multiplying an already-computed value.
`priceUnit: null` on update is handled as an explicit "clear back to whole price" signal, distinct
from `undefined` ("leave unchanged").

## Display — consolidated the duplicated price-formatting logic

`toAdminQueueRowDto`/`findMetaById`/`toCardDto`/`toDetailDto` in `listings.service.ts` now all call
two new private helpers, `formatListingPrice()` and `perUnitPrice()`, replacing what had been
three-plus separate copy-pasted "price === 0 → Contact for price" blocks. Because the formatted
`price` string already has `/unit` baked in server-side, **no changes were needed** in any
downstream display component (web/mobile/admin listing cards, detail pages, admin tables) — they
already render `price` as an opaque pre-formatted string.

`cardSpecs.ts`'s `"unit"` chip kind now reads the sibling `${chip.key}Unit` attribute and uses
`areaUnitShortLabel` when present, falling back to the original fixed suffix otherwise (so
`carpetAreaSqft`/`sizeSqft` chips are unaffected). A new `"text"` chip kind renders `plotDimensions`
verbatim.

`ListingPreviewCard.tsx` (web + mobile) takes a new optional `priceUnit` prop and appends
`/${areaUnitShortLabel(priceUnit, 1)}` to its client-side preview price string.

JSON-LD in `apps/web/src/app/[city]/[[...rest]]/page.tsx`: `floorSize.unitCode` is now looked up
via an `AREA_UNIT_CODE` map (sqft→FTK, sqm→MTK, acre→ACR, hectare→HAR), with `floorSize` omitted
entirely for `cent` (no standard UN/CEFACT code exists for it). Also fixed, beyond the original
plan: `Offer.price` now re-derives the true whole-rupee total (`perUnitDigits × areaValue`) when
`priceUnit` is set, rather than reporting the per-unit display figure as the schema.org offer
price — the original plan didn't flag this as a risk, but it would have been a real correctness
bug (understating the price a buyer actually pays, in structured data crawlers read).

## Explicitly out of scope (unchanged from the plan)

- **Search/filter changes.** `price` stays the only sortable/filterable figure.
- **Rent.** `priceUnit` is never valid for `transactionType: rent`.
- **Dimensions → area auto-fill.** `plotDimensions` is purely descriptive text.
- No new automated tests were written specifically for `resolveListingPrice`/`formatListingPrice`/
  `assertValidAreaUnit` — a known gap, flagged rather than silently left out.

## Verification performed

- Typecheck clean across bff/web/mobile/admin.
- Targeted `eslint` (no `--fix`, specific files only) clean aside from pre-existing CRLF/prettier
  noise.
- Full test suites green: bff 84 tests (`listings.service.spec.ts`), web 11, admin 22, mobile 38 —
  none newly broken.
- Production builds succeeded for bff (`nest build`), web (`next build`), admin (`next build`).
  Mobile has no comparable prod build step in this environment (Expo/EAS); typecheck + jest was
  the verification ceiling there.
- Migration generated and applied via `prisma migrate dev` against local Docker Postgres.
