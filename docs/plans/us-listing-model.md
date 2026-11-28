# US listing model: property types, deal types and forms

Status: **approved 2026-11-28 with the recommendations below; phase 1 deployed to the US the same day** (pull request 111,
image `sha-a621e459`: `bff`, `web`, `admin`; India not deployed). **Phase 2 deployed to the US the same day** (pull request 112, image `sha-c4806155`: `bff`, `web`, `admin`). The app needs a
new build. **Phase 3 deployed to the US the same day** (pull request 114,
image `sha-040f8e56`; the migration was applied to the US database). **Phase 4 built, not merged or deployed.** Part of the US launch
([us-market-expansion.md](us-market-expansion.md)). Builds on
[us-categories-condo-townhouse-room.md](us-categories-condo-townhouse-room.md) and, if approved, replaces parts of it
and of [us-price-limits.md](us-price-limits.md).

## Goal

The US site should list property the way the large US sites do. Today it is India's model with a few fields hidden:

- An apartment can be sold, as a single unit, with the same form as a condo.
- Homes offer both "Rent" and "Lease".
- There is no way to sell a multi-family building or land.
- The forms ask India questions: RERA registered, water source (corporation or borewell), "Godown" storage, ownership by
  power of attorney, carpet area, "Society / project name".
- US facts are missing: HOA fee, year built, lot size, laundry, heating and cooling, lease term. Bathrooms are whole
  numbers only, so 1.5 baths cannot be entered.

## What US sites do

| Site | For sale | For rent |
|---|---|---|
| Zillow | House, townhome, multi-family, condo / co-op, lot / land, manufactured | House, apartment / condo / co-op, townhome; rooms in its rental tool |
| Redfin | House, condo, townhouse, multi-family, land, other (co-op and manufactured in its data) | not checked |
| Realtor.com | Single family, condo, townhome, multi-family, mobile, farm, land | Separate rental search |
| LoopNet (commercial) | Office, retail, industrial, apartment / multifamily, hospitality, self-storage, land | "For lease": office, retail, industrial, land |

How sure this is: taken from web search on 2026-11-28, mostly third-party descriptions; the live filter menus were not
opened. Sources disagree on one point: some tool documentation lists "Apartments" in Zillow's for-sale filter, while
Zillow's own help article, Redfin and Realtor.com list no apartment among sale types.

## Proposal

### 1. Deal types

| Property | US offers | Today |
|---|---|---|
| House, townhouse | For sale, For rent | Sale, Rent, Lease |
| Condo / Co-op | For sale, For rent | Sale, Rent, Lease |
| Apartment | **For rent only** | Sale, Rent, Lease |
| Room | For rent | Same |
| Multi-family (new) | For sale | not offered |
| Land (new on US) | For sale | not offered |
| Commercial | For sale, **For lease** | Sale, Rent, Lease |
| Self-storage | For rent | Rent, Lease |

- In US homes "lease" means renting; its length becomes a **Lease term** field. The tab "Rent & Lease" becomes "Rent".
- Existing US ads: a home "lease" becomes "rent"; a commercial "rent" becomes "lease".

### 2. Property types

| Change | Detail |
|---|---|
| Rename | "Condo" to **"Condo / Co-op"** |
| Remove | **Villa** (no US site above has it); existing ads become House |
| Add | **Multi-family**: duplex to apartment building, with number of units. This replaces the earlier idea of an "Apartment building" option under Commercial |
| Add | **Land**: the existing `plot` category, labelled Land, with US fields |
| Later | Manufactured home |

A whole apartment building is sold as Multi-family. A single unit someone owns is sold as Condo / Co-op.

### 3. Forms

A US field list of its own, instead of India's list with fields hidden.

| Area | Remove on the US | Add or change |
|---|---|---|
| Size | "Carpet area" | **Square feet**; lot size (house, townhouse, multi-family, land); **year built** replaces "Property age" bands |
| Rooms | Balcony count; required floor and total floors | **Half baths** (1, 1.5, 2); floor optional and only for apartment and condo |
| Parking | Open / closed counts | Garage, driveway, street or none, with spaces |
| Home | Water source, gas pipeline, "Society / project name" | **Laundry** (in unit, on site, none); heating; cooling; "Community / building name"; furnishing optional |
| Sale | RERA, home loan available, ownership list, possession status, brokerage fields | **HOA fee** (monthly); yearly property tax (optional); new construction yes / no |
| Rent | "Lock-in period", maintenance fee, brokerage fields | **Lease term**; security deposit (kept); application fee; pets (cats, dogs, none); utilities included; available date |
| Commercial | Fire NOC, pantry, workstation capacity | Types: office, retail, industrial / warehouse, restaurant, hotel, self-storage facility, land, other |
| Storage | "Godown", two-wheeler access | Types: self-storage unit, garage, vehicle / RV storage, warehouse space |

- **Brokerage:** proposed to remove the fee fields and keep "Listed by: Owner / Agent". Broker-fee and commission rules
  differ by state and city, so this needs legal review either way.
- **Fair Housing:** a pets field must not suggest assistance animals can be refused; show a short note beside it.

### 4. Price limits that change

| Type | Allowed |
|---|---|
| Multi-family: sale | $50,000 to $200,000,000 |
| Land: sale | $1,000 to $50,000,000 |
| Commercial: sale | raise the maximum from $30,000,000 to $200,000,000 |

These are wide guards, not based on researched averages. $200,000,000 is the most the price box accepts
(`listingLimits.ts`). Apartment sale and the unused storage sale range go away.

## Phases

| Phase | Content | Needs |
|---|---|---|
| 1 | Deal types, apartment rent-only, villa removed, "Condo / Co-op", hide India-only questions | No database change |
| 2 | US field list: new fields, half baths, lease term, HOA | No database change expected (attributes are stored as free-form data) |
| 3 | Multi-family and Land | Database migration (new category), menus, filters, requirements |
| 4 | Manufactured homes; commercial price per sq ft per year; search filters on the new fields | |

Each phase touches the shared package, server, website, admin and app. India keeps its categories, fields and deal types,
pinned by tests. Each phase needs a US deploy and a new app build.

## Phase 1 as built

- **Deal types:** `postableTransactionTypes(category, marketId)` (`postingRules.ts`). The server refuses a US pair outside
  it with a plain message (`marketDealIssue`); India's server still checks nothing new.
- **Commercial lease:** quoted per month only. Price per unit of area is offered for sales only, because US lease rates
  are quoted per year and a typed rate would be read twelve times too high.
- **Requirements:** the US asks no "rent or lease"; commercial space becomes a lease, everything else a rental. The
  website's requirement screens were also offering India's categories on the US; they now offer the US list.
- **Hidden questions:** RERA, water source, gas pipeline, ownership, home loan, possession status, balcony count, fire
  NOC and the four brokerage fee fields (`hiddenFieldKeys`).
- **Villa** removed from the US categories. **"Condo / Co-op"** in pickers, filters and the admin.
- **Price limit:** the commercial sale maximum is $200,000,000.
- **Addresses:** US apartment rentals keep `/rent-lease/apartment`. `/buy/apartment` redirects to `/buy/condo`, and
  `villa` addresses redirect to `house` (`retiredPathSegments`).
- **Existing data:** the US database had no ads, requirements or saved searches (counted 2026-11-28), so nothing was
  converted.
- **Left for phase 2:** "Carpet area" and "Society / project name" labels, "Godown" storage type, maintenance fee as HOA
  fee, required floor fields, and everything in the "Add or change" column.
- Tests: `apps/bff/src/market/us-listing-model.spec.ts`, `apps/web/src/lib/usCategories.test.ts`.
- Checked live after the deploy: the post form lists the US types, "Sell" disables apartment, room and storage, the condo
  form asks none of the hidden questions, the old apartment-sale and villa addresses redirect, and India's apartment and
  villa pages still answer.

Also seen on the live condo form, to take into phase 2 or its own change: the AI copy helper offers Indian languages;
amenities use India's words ("Lift", "Power backup", "Club house"); and the form still mentions Featured ads and assisted
posting although nothing is sold in the US.

## Phase 2 as built

The US has a field list of its own (`packages/types/src/usCategoryFields.ts`), read through
`categoryFieldsFor(category, "us")`. India still reads `CATEGORY_FIELD_CONFIG` itself. A key is kept wherever the meaning
is the same, so cards, filters, saved searches and requests keep reading one value.

| Form | Asked in the US |
|---|---|
| House, townhouse | Bedrooms, full and half bathrooms, square feet, lot size (acres), year built, parking type and spaces, furnishing (optional), laundry, heating, cooling, community name, gated community |
| Apartment, condo | The same without lot size, plus an optional floor |
| Home for rent | Security deposit, application fee, utilities included, available from, lease term, pets, price negotiable |
| Home for sale | Monthly HOA fee, yearly property tax, new construction |
| Storage | Size, type (self-storage, garage, vehicle / RV, warehouse), access hours, ceiling height, drive-up access, loading dock, on-site security, climate control, deposit, available from, lease term, website |
| Commercial | Area (sq ft or acres), property type (office, retail, industrial / warehouse, restaurant, hotel, self-storage, land, other), floor, furnishing, restrooms, parking spaces, year built, elevator; for lease: deposit, available from, lease term, yearly increase; for sale: property tax |
| Room | Unchanged; its pet question moved beside the room details |

Differences from the proposal:

- Half bathrooms are a count of their own, as US listing services record them; a card shows "2.5 Baths".
- Pets are a multiple choice; "no pets" reads "No pets (assistance animals are welcome)".
- Furnishing item counts (sofas, geysers and so on) are not asked.
- Amenities are security cameras, elevator, fitness center, pool, clubhouse and playground.
- The US server still refuses the questions it must not ask, although the US list no longer names them.
- Buyers' requests offer the same choices as the US ad form.
- The AI writing helper no longer offers Indian languages on the website (the app already did not).

Not done: Featured and assisted-posting mentions on the US form; half bathrooms in the pages' structured data; search
filters on the new fields (phase 4); the website's test-ad scenarios still fill India's answers.
Tests: `apps/bff/src/market/us-listing-form.spec.ts`.

Checked live after the deploy: the apartment-for-rent form shows the fields above with US wording and no AI language
choice, the US server returns the new field list and "2.5 Baths", and the main US and India pages answer. Signed-in
preview and publishing were not tried.

## Phase 3 as built

- **Multi-family** is a new category, `multifamily` (migration `20261128090000_add_multifamily_category`, one added enum
  value). **Land** is the existing `plot` category, offered in the US and named "Land" there. Both are for sale only.
- Multi-family asks: number of units (2 or more), occupied units, building square feet, lot size, year built, parking,
  yearly gross rent, property tax.
- Land asks: lot size (sq ft or acres, also usable for a price per unit), zoning, utilities at the lot, road access,
  dimensions, property tax.
- Price limits as proposed in section 4.
- Menus, filters, search words ("duplex", "apartment building", "land"), buyers' requests, cards and the admin include
  both. Address segments are the category values: `/multifamily` and `/plot`. A `/land` address was not added; it is
  cheap to add only while US pages are not indexed.
- The US About and Terms pages now name the two types.
- India offers nothing new. Its database receives the same added enum value at its next deploy.
- Not done: the admin's saved-search editor still lists India's categories; buyers' requests ask no zoning question.
- Tests: `apps/bff/src/market/us-multifamily-land.spec.ts`.

Checked live after the deploy: the migration ran and the database lists the new value; the multi-family and land browse
pages answer with their US titles; the server returns empty results for both and refuses a $500 land price; the land post
form shows the fields above; India's apartment and plot pages answer. The multi-family post form was not opened, and
signed-in preview and publishing were not tried.

## Phase 4 as built

- **Manufactured home** is a new category, `manufactured` (migration `20261128100000_add_manufactured_category`), sold or
  rented. It asks a house's questions plus home size (single, double, triple-wide), whether the land is included or the
  lot leased, and the monthly lot rent on a leased lot. Sale limit $5,000 to $2,000,000.
- **Commercial yearly rate:** nothing new is stored. The price stays monthly; a US commercial lease shows
  "$24.50/sq ft/yr" on its card and page, worked out from price and area. The post and edit forms (website and app) have
  a box for the yearly rate that fills the monthly price. The admin edit form has no such box.
- **Search filters** (`searchFacts.ts`), website browse pages and the app's filter sheet: laundry, parking, pets (homes);
  home size (manufactured); property type (commercial); storage type; zoning (land). Each is one `?key=value`; canonical
  addresses are unchanged. India has none.
- Not done: filters on number ranges (square feet, year built, units); saved searches and AI search do not keep or read
  the new filters.
- Tests: `apps/bff/src/market/us-phase4.spec.ts`, `apps/web/src/lib/usCategories.test.ts`.

## SEO

US pages are not indexed yet (`indexable: false`), so no ranking is at risk. Addresses that stop existing (apartments for
sale, villas, lease pages) still get a redirect to the nearest page, as the project's URL rules require.

## Risks and checks before building

- Count existing US ads by category and deal type (read-only) before converting any.
- App builds made earlier will still offer the removed choices; the server refuses them with a message.
- How commercial lease prices are labelled today has not been checked. US commercial rent is often quoted per sq ft per
  year; phase 1 keeps a monthly total.
- Saved searches, requirements, AI search and AI ad copy all use these categories and need checking in each phase.

## Decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Apartment rent-only | Yes |
| 2 | Drop home "Lease", commercial "Rent" and storage "Lease" | Yes |
| 3 | Remove Villa on the US | Yes |
| 4 | Multi-family as its own type | Yes |
| 5 | Add Land | Yes |
| 6 | Remove brokerage fee fields on the US | Yes, pending legal review |
| 7 | Manufactured homes now | No, later |

## Sources

[Zillow advanced search help](https://www.zillow.com/learn/zillow-advanced-search/),
[SerpApi Zillow search API](https://serpapi.com/zillow-search-api),
[Zillow rental feed guide](https://s3.amazonaws.com/files.hotpads.com/+guides/Rental+Listing+Bulk+Feed+Guide.pdf),
[How to list a rental on Zillow](https://www.reallyo.com/blog/how-to-post-a-rental-on-zillow),
[Redfin types of houses](https://www.redfin.com/blog/types-of-houses/),
[a third-party Realtor.com search tool](https://apify.com/data_dino/realtor-scraper) (the Realtor.com row comes from
tool pages like this one),
[LoopNet](https://www.loopnet.com/),
[Apartments.com search filters](https://www.apartments.com/grow/learning-center/new-rental-search-filters).

The added fields (HOA fee, year built, lot size, laundry, heating and cooling) reflect general US listing practice; the
searches did not return any site's form listing them.
