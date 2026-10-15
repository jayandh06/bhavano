# Category and transaction-type attributes for posting an ad (15 Oct 2026)

## Goal

Ask each category the questions its buyers/tenants actually ask, and ask different ones for sale
versus rent/lease. Furniture and interiors were left out on purpose (not requested).

Everything lives in `packages/types/src/categoryFields.ts`, so the web wizard, edit form, admin
edit form and mobile wizard/edit screen all pick the fields up from the one config. No Prisma
migration: values go in the `Listing.attributes` JSONB column. **Every new field is optional**, so
nothing already posted becomes invalid or un-editable.

## Fields added

| Category | Rent / lease | Sale |
|---|---|---|
| House, apartment, villa | `securityDeposit`, `availableFrom`, `lockInPeriod` | `possessionStatus`, `propertyAge`, `ownership`, `loanAvailable`, `reraRegistered` + `reraNumber` |
| All three | `societyName`, `waterSource` | |
| Villa only | `plotAreaSqft`, `privateGarden`, `privateTerrace` | |
| PG (rent only) | `securityDeposit`, `availableFrom`, `noticePeriod`, `roomsAvailable`, `gateTimings`, `visitorsAllowed`, `foodType` + `mealTimings` (once meals are included), and a rent per sharing type (`singleSharingRent`, `doubleSharingRent`, `tripleSharingRent`, `dormitorySharingRent`, each shown once that type is ticked) | |
| Plot | | `plotType`, `roadWidthFt`, `cornerPlot`, `gatedLayout`, `titleDocuments`, `ownership`, `reraRegistered` + `reraNumber` |
| Commercial | `securityDeposit`, `availableFrom`, `lockInPeriod`, `rentEscalationPercent` | `possessionStatus`, `propertyAge`, `ownership`, `reraRegistered` + `reraNumber` |
| Commercial (both) | `washroomCount`, `carParkingCount`, `workstationCapacity`, `powerLoadKw`, `lift`, `pantry`, `fireNoc` | |
| Storage | `securityDeposit`, `availableFrom`, `lockInPeriod` | |
| Storage (both) | `storageType`, `ceilingHeightFt`, `vehicleAccess`, `loadingDock`, `securityGuard`, `climateControlled` | |
| Coworking | `securityDeposit`, `availableFrom` | |
| Coworking (both) | `operatingDays`, `totalSeats`, `hotDeskCount` / `dedicatedDeskCount` / `privateCabinCount` (per seat type offered), `dayPassPrice` | |

`availableFrom` is bucketed (immediately / within 15 / within 30 / after 30 days) rather than a
date, so it does not go stale while a listing stays up.

## Shared-code changes

- `fieldIsVisible`: `dependsOn` / `alsoDependsOn` now match a **multi-select** when the stored
  array contains the value (before, an array never equalled a string). This is what lets a PG's
  "Single room rent" follow the "Single" sharing type. `pruneHiddenAttributes` and the BFF's
  "not applicable" check use it, so un-ticking a type drops its rent.
- `FieldDef.rupees` / `FieldDef.unit`, and `formatFieldValue` / `formatFieldLabel`. Both detail
  pages used to print the stored value (`north-east`, `within-15-days`, `150000`). They now print
  the option label, grouped rupees (`₹1,50,000`) and unit suffixes. This also changes the existing
  brokerage and maintenance amounts to `₹5,000` and fixes raw select values on every category.
- `listingCompleteness` plus a "Listing 60% complete — Still blank: …" bar at the top of the
  details form on web (`CategoryFieldsAccordion`) and mobile (`CompletenessMeter`, used by both
  `CategoryFieldsForm` and the post wizard's own copy of the grid). It counts only optional,
  unanswered specifics: Yes/No switches, pre-filled counts, brokerage terms, website, amenities
  and furnishing are excluded, because their "blank" is not an unanswered question. It never
  blocks posting.

## Deliberately not done

- **`approvedBy` (plot) stays free text.** Turning it into a list would make every stored value
  "Pick again" on edit. `titleDocuments` carries the structured part instead.
- **Maintenance-included-in-rent** is not added: it contradicts the existing "Has monthly
  maintenance?" toggle on the same listing.
- **No browse filters** for the new fields. Add one only with the filter and its URL/SEO route
  together (see `contextual-search-filters.md`); today they only show on the post form and the
  detail page.
- **Not built:** auto-drafted description (`listingCopyAssist` already exists), "reuse last
  listing's answers", and price-vs-area hints. Each is its own change.

## Known caveats

- A PG's own price field is still the single "from" rent; the per-type rents sit beside it.
- `pnpm --filter @bhavano/mobile typecheck` crashes with "Maximum call stack size exceeded" on a
  clean checkout too (confirmed by stashing these changes). The mobile screens were therefore not
  type-checked; web, admin and BFF are clean.
- Two BFF specs fail on a clean checkout and still do: "accepts commercial brokerage…" and
  "checks a fee sent in the edit against the stored price" (both "Furnishing is required").

## Tests

`apps/bff/src/listings/category-attribute-fields.spec.ts`: per-category visibility for rent vs
sale, multi-select gating and pruning, option validation, the escalation cap, and the formatter.
