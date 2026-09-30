# Saved searches: multi-area (up to 5), mandatory city + price range, bedroom buckets, inline save

## Status: implemented 2026-09-30, not yet deployed

## Request

> "Allows only one area to search, user should be able to multi-select upto 5 area in a city, city
> is mandatory price range is mandatory, No. of bedrooms to be from 1, 2, 3, 4, 5+"
>
> "Along with going to separate page for saved search should be able to save from filters tab itself
> once all mandatory conditions are entered should ask for the name and save the search"

## Schema change

`SavedSearch.areaId String? / area Area?` → `areaIds String[] @default([])` (no relation — same
"array of ids, resolved by a manual batched lookup" convention already used by
`Requirement.areaIds` and `SearchEvent.areaIds`, not a Prisma relation array). `bedrooms Int?` →
`bedroomOptions Int[] @default([])`.

Migration `20260930060000_saved_search_multi_area_bedrooms`: adds both array columns, backfills
`areaIds = ARRAY[areaId]` / `bedroomOptions = ARRAY[bedrooms]` where the old column was non-null,
then drops the old FK constraint and both old columns.

**Clean replace, not additive** (unlike `Requirement`, which kept its old scalar fields alongside
new arrays for back-compat): `SavedSearch` has far fewer external readers than `Requirement` did
when it grew arrays, so there was no back-compat surface worth preserving here.

## "Mandatory" is a form/DTO rule, not a DB constraint

`cityId`, `minPrice`, `maxPrice` stay nullable in the schema. Two reasons:

1. **56 existing rows** include nulls in these fields (mostly system-generated from empty
   requirement captures) — a DB-level `NOT NULL` would have required a backfill with no correct
   value to backfill to.
2. `RequirementsService.alertCriteria()` → `SavedSearchesService.create()` is a second, internal,
   deliberately-looser caller that has never guaranteed these fields are set. Making
   `CreateSavedSearchDto`'s TypeScript shape mandatory would have broken that path at compile time
   for no product reason — the mandatory rule is specifically for a *person* creating an alert by
   hand, not for the system inferring one from a browse session.

So enforcement is: `CreateSavedSearchDto` keeps `cityId`/`minPrice`/`maxPrice` optional (with
`class-validator` shape/range checks when present), and both web forms
(`SavedSearchesManager`, `SaveSearchButton`) block submission client-side unless all three are set.
`SavedSearchesService.create()` still rejects `minPrice > maxPrice` server-side regardless of
caller.

## Area cap and bedroom buckets

- `MAX_REQUIREMENT_AREAS` (5, from `packages/types/src/requirementQuestions.ts`) reused directly
  rather than a second constant — `CreateSavedSearchDto.areaIds` is `@ArrayMaxSize(MAX_REQUIREMENT_AREAS)`,
  and `SavedSearchesService.create()` dedups and caps at the same number when composing
  `dto.areaIds` with an ad-hoc `dto.areaName` (via `LocationsService.ensureArea`).
- `MAX_BEDROOMS` / `bedroomLabel()` (`packages/types/src/bedrooms.ts`) reused the same way —
  `bedroomLabel(n)` renders `"5+"` for `n >= 5`. Both web forms render a fixed row of toggle chips
  for `1..MAX_BEDROOMS`, not a free-number input.
- Matching: `bedroomsMatch(bedroomOptions, listingBedrooms)` — empty `bedroomOptions` matches any
  listing (an unset filter, not "zero bedrooms"); non-empty matches a listing whose bedroom count
  is in the set, with `MAX_BEDROOMS` meaning "`MAX_BEDROOMS` or more." Area matching:
  `{ areaIds: { isEmpty: true } }` (any area in the city) or `{ areaIds: { has: listing.areaId } }`.

## Inline "Save this search" on the browse page

New `apps/web/src/components/home/SaveSearchButton.tsx`, wired into
`BrowseListingsView.tsx`'s filters strip (last pill, after `OwnersOnlyToggle`). Per the user's own
framing — "once all mandatory conditions are entered should ask for the name and save the search"
— it does not re-collect area/bedroom criteria: it reads the page's already-resolved
`query.{cityId,areaIds,category,transactionType,minPrice,maxPrice,bedrooms}` as props and renders
nothing until `cityId` and both prices are set (the same two-field gate `SavedSearchesManager`
enforces). A click checks `hasSessionAction()` first — logged-in visitors go straight to an inline
name prompt; logged-out visitors go through the existing `useAuthGate().requireLogin({onSuccess})`
flow and land in the same prompt once signed in. Submitting calls the existing
`createSavedSearchAction`, sharing one BFF endpoint and one free-quota/Plus gate with the
standalone `/saved-searches` form — a `ForbiddenException` ("Bhavano Plus is required…") once the
free quota is used surfaces inline the same way it does there.

The standalone `/saved-searches` page (`SavedSearchesManager.tsx`) is unchanged in purpose — it's
still where someone with no browse-page context builds an alert from scratch, or manages/deletes
existing ones — but its create form now has the same multi-area checkbox list (capped at 5, plus a
free-text "add an area not listed here"), mandatory city/price fields, and bedroom-chip row.

## Not doing

- No change to the free-quota/Plus gate itself (`docs/plans/saved-search-free-quota-paywall-bug.md`)
  — the inline button reuses it as-is.
- No area/bedroom re-entry in the inline button — it trusts the page's own filter state, which is
  the entire point of placing it in the filters strip instead of linking to the standalone form.
- Mobile: still has no saved-search UI at all (flagged earlier in this same investigation) — out of
  scope for this change.

## Rollback

Revert the migration (`prisma migrate resolve` back one step, or reapply the inverse: recreate
`areaId`/`bedrooms`, backfill from `areaIds[0]`/`bedroomOptions[0]`, drop the array columns) and
revert the BFF/web commits together — the DTO, service, and both web forms all changed shape in
the same step and don't work independently.
