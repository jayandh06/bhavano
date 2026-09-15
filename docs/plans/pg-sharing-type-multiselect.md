# PG "Sharing type" → multi-select (a PG can offer more than one)

## Context

`sharingType` (Single / Double / Triple / Dormitory) is currently a `type: "select"` field in
`CATEGORY_FIELD_CONFIG.pg` (`packages/types/src/categoryFields.ts`), so a listing can only claim
one. In practice many PGs offer several at once. The adjacent `gender` field in the same config
already made this exact single→multi conversion (comment at `categoryFields.ts:574-577` explains
why), so that migration is the template to follow — but research turned up two things worth
knowing before repeating it:

1. **`gender`'s own migration was left half-done.** It's `multi-select` in the config and validated
   as an array server-side, but `packages/types/src/cardSpecs.ts`'s `optionLabel` (the card-chip
   label lookup) still requires `typeof value === "string"`, so the "Preferred for" chip has
   silently never rendered on any PG card since. `gender` was also never wired into any filter/URL
   facet system, so that gap is its only loose end. This plan fixes `optionLabel` generically (not
   `sharingType`-specific), which incidentally fixes `gender`'s chip too — free, since we're
   touching that function anyway.
2. **`sharingType`, unlike `gender`, *is* wired into the facet/URL/filter system** (mega-menu links,
   the homepage/browse `?sharingType=` query param, the BFF's list-listings filter, and the
   homepage's "recent mix" round-robin grouping) — this is the part that needs real code changes,
   not just a type flip. The good news, confirmed by reading `buildListingPath` and the
   `[city]/[[...rest]]` catch-all redirect: **a facet is a browse-page-only concept** — it is never
   part of an individual listing's own canonical URL, and nothing ever derives "this listing's one
   true facet value" back out of a listing (the redirect would 301 away before any such code could
   run). So the URL/mega-menu/browse-link side of the system needs **zero changes** — it only ever
   builds "filter by this one value" links and checks "does this listing's value *include* X",
   which stays correct once the stored value becomes an array. The one place that currently does an
   exact-equals match against the stored (soon-to-be-array) value is the real fix needed.

No Prisma migration: `Listing.attributes` is a plain untyped `Json` column (`schema.prisma:343`),
no index or generated column keyed on `sharingType`. This is purely an application-layer contract
change, exactly like `gender`'s was.

---

## Changes

### 1. `packages/types/src/categoryFields.ts` — the type flip

`CATEGORY_FIELD_CONFIG.pg`'s `sharingType` entry (~line 560-573): `type: "select"` →
`type: "multi-select"`. Add a comment mirroring `gender`'s (`:574-577`) explaining why. This alone
makes posting-time validation array-aware for free — `assertValidAttributes`
(`apps/bff/src/listings/listings.service.ts:2001+`) dispatches purely on `field.type`, and every
generic form renderer (web `PostAdWizard`/`EditListingForm`, mobile `PostAdWizard`, admin's
`AdminEditListingForm` — its `CheckboxDropdown`) already handles `multi-select` fields correctly
since `gender` already exercises that exact path today.

### 2. `apps/bff/src/listings/listings.service.ts` — the two places that assume a scalar

- **List filter (~line 402-405)**: change the exact-match JSON filter to Prisma's Postgres JSON
  array-containment filter, same shape:
  ```ts
  if (sharingType)
    attributeFilters.push({
      attributes: { path: ['sharingType'], array_contains: sharingType },
    });
  ```
  (Confirmed: `array_contains` isn't used anywhere else in this codebase yet, but it's the correct
  Prisma/Postgres JSON-array operator for "does this JSON array contain this value" — the direct
  analogue of the `equals` clause it replaces.) This is the load-bearing fix — without it, every
  PG mega-menu/facet link would silently return zero results once listings store an array.

- **`recentMixGroupKey` (~line 283-300)**: the pg/furniture/interiors branch currently does
  `typeof facetValue === 'string' && facetValue ? facetValue : 'unspecified'`, with a comment
  asserting "a facet is always a plain string." Furniture's `condition` and Interiors' `serviceType`
  stay plain selects (unaffected), but pg's `sharingType` won't be anymore. Extend to accept an
  array, joining sorted values into one stable group key so a "single+double" PG groups distinctly
  from a "single"-only one:
  ```ts
  const facetLabel = Array.isArray(facetValue)
    ? facetValue.filter((v): v is string => typeof v === 'string' && v.length > 0).sort().join('+')
    : typeof facetValue === 'string' ? facetValue : '';
  dimension = facetLabel || 'unspecified';
  ```

- **`assertValidAttributes`'s required-field check (~line 2059-2071)**: currently only tests
  `value === undefined || value === null || value === ''`, so a submitted empty array `[]` would
  incorrectly satisfy a `required: true` multi-select field (relevant here since `sharingType` is
  `required: true`, unlike `gender`). Add an array-empty case to the same missing-value check (a
  small generic helper, not `sharingType`-specific):
  ```ts
  const isMissing = (v: unknown) =>
    v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  if (isMissing(value) && isMissing(legacyValue)) { throw ... }
  ```

### 3. `packages/types/src/cardSpecs.ts` — fix `optionLabel` for array values (and `gender`'s chip, free)

Generalize `optionLabel` to accept either a scalar or an array, joining multiple labels with ", ":
```ts
function optionLabel(category: ListingCategory, key: string, value: unknown): string | undefined {
  const field = CATEGORY_FIELD_CONFIG[category]?.find((f) => f.key === key);
  if (!field) return undefined;
  const values = Array.isArray(value) ? value : typeof value === "string" && value !== "" ? [value] : [];
  const labels = values
    .map((v) => field.options?.find((o) => o.value === v)?.label)
    .filter((l): l is string => Boolean(l));
  return labels.length > 0 ? labels.join(", ") : undefined;
}
```
No other change to `cardSpecs.ts` needed — `deriveCardSpecs`'s existing blank-skip check
(`raw === undefined || raw === null || raw === ""`) already lets an array value through to
`optionLabel`, which now correctly returns `undefined` for `[]` too.

### 4. Data backfill — mirror `apps/bff/prisma/migrateGenderToMultiSelect.ts` exactly

New `apps/bff/prisma/backfillSharingTypeMultiSelect.ts`: same idempotent shape (find `category: 'pg'`
rows, rewrite `attributes.sharingType` from a bare non-empty string to `[value]`, skip rows already
in array form), same doc-comment structure explaining why (opening the edit form on an unmigrated
listing would show "Sharing type" as unselected, and saving would silently wipe it to `[]`).
Register as `"backfill:sharing-type-multiselect": "tsx prisma/backfillSharingTypeMultiSelect.ts"`
in `apps/bff/package.json`, next to `backfill:gender-multiselect`.

### 5. Other server-side writers of `attributes.sharingType`

- **`apps/bff/prisma/seedDemoListings.ts`** (~line 135, 174-182): `sharingType` (bare string) →
  array, e.g. `[SHARING[i]]` or a small mix for variety. While in there, also fix the pre-existing
  `gender: gender.value` (also a bare string, also wrong since `gender` is already multi-select) —
  this file calls `prisma.listing.createManyAndReturn` directly, bypassing
  `ListingsService.create`/`assertValidAttributes` entirely, which is why this was never caught.
- **`apps/bff/src/outreach/outreach.service.ts`** (~line 636, inside `createListingFromContact`):
  `sharingType: 'single'` → `sharingType: ['single']`. This path *does* go through
  `ListingsService.create()`, so it's already subject to `assertValidAttributes`.

### 6. Tests — `apps/bff/src/listings/listings.service.spec.ts`

Update fixtures from scalar to array at the `recentMixGroupKey` call sites (~line 151, ~263-265) to
match change #2's grouping fix; update their expected group-key assertions accordingly. Leave the
unrelated diff-test fixture at ~line 1182 as-is unless touching it for consistency is free.

### 7. Python bulk-import pipeline

- **`bulk_upload_listings.py`**: the multi-select convention is already generic and documented —
  add `"sharingType"` to the existing `MULTI_SELECT_ATTRIBUTE_KEYS = {"gender"}` set (→
  `{"gender", "sharingType"}`). `build_attributes()` already `;`-splits any key in that set into a
  JSON array; no other change needed.
- **`export_outreach_contacts_for_listings.py`**: no code change — this column
  (`attr_sharingType_REQUIRED`) is already left blank for a human to fill in (sharing type isn't
  inferable from Google Places data), and the `;`-join convention is already documented in
  `guess_gender`'s docstring for the adjacent `attr_gender` column. Optionally add a one-line
  comment near `ATTRIBUTE_COLUMNS` noting the `;`-join convention applies to this column too, since
  nothing currently pre-fills an example of it there the way `guess_gender` does for `attr_gender`.

### 8. Everything confirmed to need NO changes

- `apps/web/src/lib/seoRoute.ts`, `apps/web/src/lib/homeCategories.ts`,
  `apps/mobile/src/components/home/categories.ts`, `apps/mobile/app/(tabs)/index.tsx`,
  `apps/web/src/lib/bff.ts`, `apps/mobile/src/lib/bffClient.ts`, `apps/bff/src/listings/dto/list-listings.dto.ts` —
  all of these only ever read `.options` (unaffected by the type flip) or pass/parse a single
  filter *value* (never assume the stored attribute has exactly one value). Confirmed via
  `buildListingPath` (`packages/types/src/listingPath.ts`) and the `[city]/[[...rest]]` canonical
  redirect that a facet is a browse-page-only concept, never derived back out of an individual
  listing.
- `apps/web`'s posting/edit forms, `apps/mobile`'s posting form, `apps/admin`'s
  `AdminEditListingForm` — all render `multi-select` fields generically already (proven by `gender`
  working correctly in every one of these today).
- No Prisma schema migration.

---

## Verification

- `pnpm --filter @bhavano/types build`, `pnpm --filter bff typecheck`/`build`, `pnpm -w typecheck`.
- `pnpm --filter bff test -- listings.service.spec.ts` after updating the fixtures in #6.
- Manually post/edit a PG listing on web, mobile, and admin, selecting more than one sharing type —
  confirm it saves and the checkbox state round-trips correctly on reopen.
- Confirm a PG card shows a joined "Single, Double sharing" chip (and, as a bonus check, that the
  "Preferred for" chip now also renders when `gender` has values).
- Hit a PG mega-menu link (e.g. `/bengaluru/rent-lease/pg/double`) for a listing that offers both
  single and double — confirm it now appears (this is the filter that was silently broken before
  the `array_contains` fix).
- Run `pnpm --filter bff backfill:sharing-type-multiselect` against a dev DB seeded with old-shape
  (bare-string) PG listings, confirm it normalizes them and is a no-op on a second run.
- Confirm a `bulk_upload_listings.py` CSV row with `attr_sharingType_REQUIRED` set to
  `single;double` uploads correctly as `["single", "double"]`.
