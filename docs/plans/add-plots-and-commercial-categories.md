# Add Plots (buy) and Commercial Space (rent/lease) categories

## Scope

Two new `ListingCategory` values, added as siblings within the *existing* Buy and Rent & Lease
groupings — not new top-level home tabs (unlike PG/Furniture/Interiors):

- **`plot`** ("Plots") — sell-only, reachable under the **Buy** tab, alongside House/Apartment.
- **`commercial`** ("Commercial Spaces") — rent/lease-only, reachable under **Rent & Lease**,
  alongside Storage/Coworking (same treatment as those two: a `singleLinkColumn1Item` in the mega
  menu, not a `bhkColumn1Item` — no bedroom facet).

This matches the literal request ("buy Plots", "Rent or lease commercial space") rather than also
allowing Buy-commercial or Rent-plot, which nothing asked for.

## Field schemas (new `CATEGORY_FIELD_CONFIG` entries)

**Plot**: `plotAreaSqft` (number, required), `facing` (select: N/S/E/W/NE/NW/SE/SW), `boundaryWall`
(select: Yes/No), `approvedBy` (text, placeholder "e.g. BDA, Panchayat, DTCP").

**Commercial**: `sqft` (number, required), `purpose` (select: Office/Retail/Warehouse/Showroom/
Restaurant/Other, required), `floor` (text, placeholder "e.g. Ground, 2nd floor"), `furnished`
(select: Unfurnished/Semi-furnished/Furnished — reuses the residential 3-value convention).

## Other per-category values (grounded in existing sibling categories)

- `POSTABLE_TRANSACTION_TYPES`: `plot: ["sell"]` (matches `interiors`' sell-only shape);
  `commercial: ["rent", "lease"]` (matches `storage`/`coworking` exactly). `categoryGroupsFor()`
  derives Buy/Rent-Lease reachability from this automatically — no separate map to update.
- `PRICE_BOUNDS`: `plot` sale = same band as house/apartment (land spans the same price range);
  rental mirrors sale with a "never reached" comment (same pattern `interiors` already uses).
  `commercial` rental = ₹5,000–₹20,00,000/month (small shop to large warehouse); sale is an
  unreached placeholder (same house/apartment band, same "never reached" pattern).
- `PRICE_QUALIFIER_OPTIONS`: `plot: { sell: SELL_OPTIONS }`; `commercial: { rent: MONTHLY_OPTIONS,
  lease: MONTHLY_OPTIONS }` (matches `storage`'s plain per-month treatment).
- `deriveTag`: explicit `'PLOT'` / `'COMMERCIAL'` badges, matching how every non-house/apartment
  category already gets its own distinct tag instead of falling into generic FOR SALE/FOR RENT.
- `categoryImagePlaceholder`: new color pairs + labels for the two categories.
- `CATEGORY_LABELS`: `plot: "Plots"`, `commercial: "Commercial Spaces"` (plural, matching
  `"Storage Spaces"`/`"Coworking Desks"`).
- `PropertyTypeFilter` / `PROPERTY_TYPES_BY_TAB`: `plot` added to `buy`, `commercial` added to
  `rentLease` — same mechanism that already makes Storage/Coworking selectable sub-filters.

## Copy decisions

- **Site `<title>`** (`layout.tsx`): kept short by switching the trailing category list to
  `"& More"` instead of naming every category (`"Bhavano — Buy, Rent, Plots, Coworking, PG & More"`)
  — appending every category by name would push well past the ~60-char safe zone for SERP titles.
  The meta **description** has more room and stays fully enumerated (includes Plots, Commercial
  Spaces, and Furniture).
- Header tagline, Footer blurb, Help FAQ ("What can I list?"), Terms §2 ("What Bhavano is"), and
  the 404 page's example links all get Plots + Commercial Spaces added to their category lists.
  Privacy Policy doesn't enumerate categories anywhere, so it's untouched.

## Touch points (grounded by repo-wide search, not assumed)

**Schema**: `apps/bff/prisma/schema.prisma` (enum) + new migration (`ALTER TYPE … ADD VALUE`,
matching the precedent `20260718043000_add_interiors_category` migration).

**`packages/types`**: `index.ts` (`ListingCategory`, `PropertyTypeFilter`), `categoryFields.ts`,
`postingRules.ts`, `priceBounds.ts`, `priceQualifiers.ts`, `tokens.ts`, `listingTag.ts`.

**BFF**: `list-listings.dto.ts`, `list-admin-listings.dto.ts`, `create-listing.dto.ts` (all three
have their own literal `LISTING_CATEGORIES`/`PROPERTY_TYPES` arrays — no shared constant),
`listings.service.ts` (`PROPERTY_TYPES_BY_TAB`), `seedDemoListings.ts` (`CATEGORY_STYLE` +
`deriveFields` — the combo list itself is already generic over `POSTABLE_TRANSACTION_TYPES`, so
these two are the only required edits; TypeScript's switch-exhaustiveness check enforces it).

**Web**: `seoRoute.ts` (`LISTING_CATEGORIES`, `CATEGORY_LABELS`), `homeCategories.ts` (mega-menu
entries under Buy/Rent & Lease), `parseSearchQuery.ts` (search-bar keyword patterns:
plot/land, commercial/shop/office), `PostAdWizard.tsx` (step-1 category picker), plus the copy
files above.

**Mobile**: `categories.ts` (home-tab `propertyTypes` lists), `PostAdWizard.tsx` (same category
picker as web, independently maintained). Admin app has no category-specific UI (verified — no
`ListingCategory` reference in `apps/admin/src` at all), so nothing to change there.

## Verification

- `pnpm typecheck` across all 5 packages (rebuild `@bhavano/types` and regenerate the Prisma
  client first, since both are consumed as compiled/generated output elsewhere).
- Re-run `seedDemoListings.ts` and confirm it produces real Plot/Commercial listings with photos,
  proving `deriveFields`'/`CATEGORY_STYLE`'s exhaustiveness actually covers the new categories
  rather than just satisfying the compiler.
- Live: `/{city}/buy/plot` and `/{city}/rent-lease/commercial` resolve with real listings; the
  homepage's Buy/Rent & Lease mega-menus show the new links; the posting wizard's step-1 shows
  both new categories and their step-3 fields render.
