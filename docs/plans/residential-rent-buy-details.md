# Residential Rent/Buy Listing Details

## Goal

Extend House, Apartment, and Villa listings with the residence details needed for both sale and
rent/lease ads. The existing `transactionType` already represents Buy/Sell versus Rent/Lease, so
this work should not introduce a second rent/buy field. Assume the request's "Least type" means
"Lease type"; confirm the exact business meaning before implementation if it is intended to be a
new field.

## Current implementation

- `packages/types/src/categoryFields.ts` is the shared schema for residential posting and editing
  forms. House, Apartment, and Villa currently reuse `RESIDENTIAL_FIELDS`.
- Listing-specific values are stored in the existing Prisma `Listing.attributes` JSONB column, so
  a Prisma table migration is not required for these fields.
- `apps/bff/src/listings/listings.service.ts` checks only fields marked `required`; create and
  update already share that validation path.
- `apps/web/src/components/home/ListingDetailView.tsx` renders attribute entries generically, but
  labels and boolean values need presentation cleanup once these fields are added.
- Existing residential seed data uses `attributes.sqft`; current browse SEO logic also reads that
  key. Existing data must remain supported during the naming transition.

## Proposed attribute contract

Add these fields to the shared residential configuration, initially applying them to House,
Apartment, and Villa:

| Key                        | Label                       | Type                                    | Required                   | Values / rule                                                                                    |
| -------------------------- | --------------------------- | --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `balconyCount`             | Balcony count               | number                                  | No                         | Integer, minimum 0                                                                               |
| `openParkingCount`         | Open parking spaces         | number                                  | No                         | Integer, minimum 0                                                                               |
| `closedParkingCount`       | Closed parking spaces       | number                                  | No                         | Integer, minimum 0                                                                               |
| `entranceFacing`           | Main entrance facing        | select                                  | No                         | North, South, East, West, North-East, North-West, South-East, South-West                         |
| `carpetAreaSqft`           | Carpet area (sqft)          | number                                  | Yes                        | Positive integer                                                                                 |
| `gatedCommunity`           | Gated community             | select                                  | No                         | Yes / No                                                                                         |
| `priceNegotiable`          | Price negotiable            | select                                  | No                         | Yes / No                                                                                         |
| `leaseType`                | Lease type                  | select                                  | Rent/Lease only, if needed | Use a confirmed controlled option list; do not invent options until product meaning is confirmed |
| `preferredTenantTypes`     | Preferred tenant type       | multi-select or normalized string array | Rent/Lease only            | Any of Family, Company, Bachelor; at least one when supplied                                     |
| `fromBroker`               | Posted by broker            | select                                  | No                         | Yes / No                                                                                         |
| `brokerageFeeApplicable`   | Brokerage fee               | select                                  | Rent/Lease only            | Yes / No; required when `fromBroker` is Yes if the fee is broker-specific                        |
| `brokerageFee`             | Brokerage fee amount        | number                                  | Conditional                | Non-negative amount; required when `brokerageFeeApplicable` is Yes                               |
| `maintenanceFeeApplicable` | Monthly maintenance fee     | select                                  | No                         | Yes / No                                                                                         |
| `monthlyMaintenanceFee`    | Monthly maintenance fee (₹) | number                                  | Conditional                | Non-negative amount; required when applicable is Yes                                             |
| `gasPipeline`              | Gas pipeline                | select                                  | No                         | Yes / No                                                                                         |

Add two grouped UI sections to the same residential configuration:

### Amenities

Use Yes/No controls for CCTV, lift, power backup, water supply, play area, gym, swimming pool,
and club house. These remain visible for all furnishing states.

### Furnishing

Use non-negative integer counts for washing machines, sofas, stoves, fridges, cupboards, fans,
lights, beds, TVs, geysers, tables, and dining tables. Show this section, and persist/display these
fields, only when `furnished` is `furnished`; clear them when the user changes to Unfurnished or
Semi-furnished. The BFF must enforce the same dependency so stale or hand-crafted payloads cannot
save furnishing inventory for a non-furnished listing.

Keep `bedrooms`, `bathrooms`, and `furnished`. Decide whether `carpetAreaSqft` replaces
`sqft` or is additive before coding. Recommended approach: make `carpetAreaSqft` the canonical
new field, continue accepting/displaying legacy `sqft` for old listings, and stop writing `sqft`
for new residential ads unless it is explicitly renamed to a different area measurement.

## Implementation steps

1. **Confirm product semantics**
   - Confirm whether “lease type” means a controlled duration/type field, or whether the existing
     `transactionType: lease` is sufficient and no extra `leaseType` is wanted.
   - Confirm whether brokerage and maintenance amounts are INR, whether brokerage is a one-time
     amount or percentage, and whether tenant type allows multiple selections.
   - Confirm whether every new field is optional or whether carpet area, parking, and broker status
     are mandatory for residential ads.

2. **Shared field schema**
   - Update `packages/types/src/categoryFields.ts` with the residential definitions and stable
     keys above.
   - Extend `FieldDef`/the form renderer if needed to support multi-select and conditional fields;
     do not encode conditional behavior only in UI labels.
   - Keep option values machine-stable and labels user-facing. Use numeric fields for counts and
     fees rather than free-text specs.
   - Add section and dependency metadata so the form and detail page share the same Amenities and
     Furnishing grouping and the furnished-only visibility rule.

3. **Client posting and editing**
   - The existing `PostAdWizard` and `EditListingForm` will automatically render shared fields;
     add the missing control type, conditional visibility, number sanitization, and validation.
   - Show lease-only fields for Rent/Lease transactions and hide or clear them for Buy/Sell.
   - Render tenant types as a multi-select control if multiple values are allowed.
   - Preserve the existing `transactionType` step and price qualifier behavior.

4. **BFF validation and API contract**
   - Strengthen `ListingsService.assertRequiredAttributes()` or add a residential attribute
     validator that validates allowed keys, integer/non-negative constraints, select values, array
     members, and conditional dependencies on both create and update.
   - Update `CreateListingDto` and `UpdateListingDto` only as necessary for the JSON attribute
     contract; the existing `Record<string, unknown>` transport can remain if runtime validation
     is centralized in the service.
   - Reject inconsistent payloads, including a fee supplied while its applicability is No,
     applicable fee without an amount, and lease-only fields on Buy/Sell listings. Decide whether
     omitted optional booleans default to No or remain unknown, and apply that consistently.

5. **Display and browse behavior**
   - Replace the generic raw-key detail output with a shared label/value formatter so users see
     “Open parking spaces: 2” and “Gated community: Yes,” not camelCase keys.
   - Format counts, square feet, rupee amounts, booleans, and tenant-type arrays consistently.
   - Add residential browse filters only where product requirements justify indexed/faceted search:
     likely carpet-area range, gated community, parking, and tenant type. If filters are added,
     update `ListListingsDto`, `ListingsService.list()`, SEO route parsing, and browse UI together.
     Do not add filters merely because a detail field exists.

6. **Compatibility and seed data**
   - Update demo and hand-written residential seeds with the new canonical fields and varied values
     so the detail UI and any new filters are exercised.
   - Keep the legacy `sqft` read fallback for existing rows, and either provide a one-time JSONB
     backfill for `carpetAreaSqft` only when the old value is known to mean carpet area, or leave it
     unset rather than silently misrepresenting area.
   - Document the attribute keys in shared types or the plan; JSONB has no database-level enum or
     constraint protection.

7. **Tests and rollout**
   - Add shared/config tests for field applicability and option values.
   - Add BFF unit tests for valid residential payloads, invalid counts/fees, conditional brokerage
     and maintenance rules, and Buy versus Rent/Lease behavior.
   - Add web tests covering the posting wizard and edit form, including conditional fields and
     multi-select tenant types.
   - Add an end-to-end detail-page assertion for formatted residential attributes and a regression
     check that legacy `sqft` listings still render.
   - Run typecheck, lint, focused BFF tests, and the relevant Playwright specs before broader CI.

## Acceptance criteria

- Buy, Sell, Rent, and Lease continue to use the existing transaction model without conflicting
  duplicate fields.
- New residential ads can collect balcony count, open/closed parking counts, entrance facing,
  carpet area, gated-community status, negotiability, broker status, gas pipeline, and the agreed
  lease/tenant/fee fields.
- Conditional brokerage and maintenance amounts cannot be saved without their applicability being
  true, and invalid numeric/select values are rejected by the BFF as well as blocked in the UI.
- Existing listings remain editable and readable, including rows that only have `attributes.sqft`.
- Detail pages show human-readable labels and values, while new browse filters are covered end to
  end if they are approved for scope.
