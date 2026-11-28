# US categories: Condo, Townhouse and Room for rent

> The US deal types, categories and menus described here were changed by [us-listing-model.md](us-listing-model.md)
> (2026-11-28): no villas, apartments for rent only, "lease" for commercial space only, and "Condo / Co-op".

## Status: built 2026-11-26 (not yet deployed or exercised in a running US app)

Part of [us-market-expansion.md](us-market-expansion.md). The owner asked to add three listing categories that exist in the US market and not in India's set (house, apartment, villa, PG, storage, coworking, furniture, interiors, plot, commercial). The
template is `add-villa-and-commercial-buy-category.md`: a new `ListingCategory` touches the shared types, the Prisma enum, the BFF validation, and web, mobile and admin.

## What is added

| Category | id | Transactions | Fields | Notes |
|---|---|---|---|---|
| Condo | `condo` | sell, rent, lease | the residential set (same as apartment) | Owner-occupied apartment; browsed with bedrooms like house, apartment and villa. |
| Townhouse | `townhouse` | sell, rent, lease | the residential set (same as house) | Row house; browsed with bedrooms. |
| Room for rent | `room` | rent | a short room-specific set | Closest India analogue is PG; no gender, food or sharing-type-by-gender fields (see Fair Housing). |

All three are **US-only**: they are added to the US market's category list, not India's, so India's forms, menus, validation and URLs are unchanged (tests pin India's lists).

## Assumptions to confirm (decided so the work could proceed; each is easy to change)

- Condo and townhouse reuse the existing residential fields (bedrooms, bathrooms, floor, furnishing, parking, society and so on, including a few India-flavoured ones such as entrance facing and gas pipeline). US-specific fields (HOA fee, year built, lot size,
  heating and cooling) are a follow-up with the rest of the US listing structure, not part of this change.
- Room for rent is month-to-month: `rent` only (no sale, no lease). Fields: room type (private or shared), bathroom (private or shared), furnished, utilities included, available from, plus the common price, location and photos. No fields that state a
  preference about who may rent (gender, family status, food), in line with the Fair Housing handling in the market config; roommate-preference exemptions under the Act are a legal question, not built.
- Price bounds are in the same numbers as India's (the US dollar amounts are numerically smaller than rupee ones, so the existing bands accept normal US prices); room rent allows from 100.
- Browse URLs follow the existing pattern (`/{city}/rent-lease/condo`, `/{city}/buy/townhouse`, `/{city}/rent-lease/room`); the new routes are not linked from India's site.

## Changes

- `packages/types`: the category union and the property-type filter (condo, townhouse); field config; posting rules; price bounds and qualifiers; image placeholders; boost pricing; labels; the US market's category list.
- `apps/bff`: `ListingCategory` Prisma enum and a migration (`ALTER TYPE ... ADD VALUE`, which also runs on India's database and is harmless there); the DTO category lists; the tab-to-category filter; seed styles.
- `apps/web`: SEO labels and slugs, browse routing, the menu and tabs (US only), search keyword parsing.
- `apps/mobile` and `apps/admin`: the exhaustive category maps the compiler flags.

## Built (what the change actually does)

- Shared types: `ListingCategory` and `PropertyTypeFilter` gain `condo`, `townhouse`, `room`; field config (condo and townhouse reuse the apartment and house fields; `ROOM_FIELDS` is new: roomType, bathroom, furnished, utilitiesIncluded, availableFrom,
  petsAllowed); card chips; posting rules; price bounds and qualifiers; image placeholders; requirement labels, questions and size question; the US market's category list; the posting picker options.
- Lists that are not exhaustive maps (the compiler cannot flag them) stay India's and the US gets its own: `intentCategories(intent, marketId)` for requirement intents, `marketPostCategoryGroups` for the posting picker (already market-filtered), the BFF
  `US_PROPERTY_TYPES_BY_TAB` for the home tabs, the web menus (`homeCategories.ts`, US only) and the search-word patterns (`parseSearchQuery.ts`, filtered to the build's market). Tests pin India's lists and the India search behaviour.
- Database: `ListingCategory` enum values and migration `20261126090000_add_condo_townhouse_room_categories` (adds enum values only; it will also run on India's database at India's next deploy, with no effect on existing rows).
- BFF: category lists in the listing, admin, saved-search, analytics, AI-copy and boost-preview DTOs; posting already used `MARKET.categories`, so the US stack accepts the three and India's does not (a spec proves it).
- Web: URL grammar (labels, slugs, property-type values, bedroom facet for condo and townhouse), the edge copy of the reserved segments, browse SEO copy, structured-data categories, the home page category links, and the US wording.
  In the US menus the bedroom links say "bed" instead of "BHK" (India unchanged).
- Admin: the two category label maps. Mobile: compiles, no change needed (its market is not switchable yet).
- Form grouping: the room fields are grouped with the existing room-details groups (PG's grouping is unchanged).

## Not in this change

- HOA fees and the other US-specific listing fields; "bed and bath" wording beyond the menus (the facet URLs are still `/2bhk`); US legal review of the room-for-rent flow; the mobile market switch and mobile category tabs.
- Boost pricing: boosts are not purchasable in the US, and the boost rules' category lists were left alone (changing them would also change India's default rule data); the new categories fall through to the flat tier price.
- The AI search prompt (`search-interpret.prompt.ts`) still lists India's categories; the rule-based search understands the new words.
- PG, Coworking and Plots are hidden from the US website menus (decided 2026-11-26: they are not US categories and cannot be posted there). India's menus are unchanged. The mobile app's menus (`apps/mobile/src/components/home/categories.ts`) are static: they show PG, Coworking and Plot, and have no condo, townhouse or room. That is harmless today because nothing sets the app's market to US (every install is India); when the market switch is built, this file must become market-aware like the web's `homeCategories.ts`.
