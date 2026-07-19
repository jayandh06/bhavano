# Seed a full listing matrix (every category × transaction type × city, with photos)

## Goal

Populate the local database with at least three listings for **every valid
(category, transactionType) combination in every seeded city**, each with at least one real,
renderable photo — so browse pages, category tabs, the mega-menu, filters, and the new
area filter all have data to work against instead of the ten hand-written demo rows in `seed.ts`.

## What the matrix actually is

`POSTABLE_TRANSACTION_TYPES` (`packages/types/src/postingRules.ts`) is the source of truth for
which combinations are real:

| category | transaction types | combos |
|---|---|---|
| house | sell, rent, lease | 3 |
| apartment | sell, rent, lease | 3 |
| pg | rent | 1 |
| storage | rent, lease | 2 |
| coworking | rent, lease | 2 |
| furniture | sell, rent | 2 |
| interiors | sell | 1 |

**14 combos × 3 records × 37 cities = 1,554 listings.**

`buy` exists in the `TransactionType` enum but is deliberately excluded: it's a browsing-side tab
(the Buy tab queries `transactionType IN ('buy','sell')`), never something a poster can create.
Seeding `buy` rows would put data in the DB that no real posting flow can produce, so the Buy tab
is covered by the `sell` rows instead. **Confirmed with the user.**

All 37 seeded cities have curated areas (verified — no city is missing an `areasByCity` entry), so
every listing can be given a real `areaId`.

## Photos — how they resolve locally

The key finding: `CDN_BASE_URL` is **empty** in local `.env`, so
`variantUrl()` (`apps/bff/src/uploads/photo-keys.ts`) emits a **root-relative** URL:

```
/photos/<listingId>_<photoNo>_preview.webp
```

Next.js serves that straight out of `apps/web/public/photos/` — so seeded photos need **no R2
credentials and no CDN at all** locally. The approach:

- Generate the images with **`sharp`** (already a BFF dependency): one category-tinted base image
  per category with a composited SVG label, rendered at both variant widths from
  `PHOTO_VARIANTS` (`preview` 480w, `full` 1600w). No network fetch, no licensing questions,
  deterministic output.
- Encode the 7 base images **once** (14 encodes total), then **file-copy** them per listing.
  Re-encoding ~3,100 files would dominate the runtime; copying is effectively free.
- Build filenames with the real `variantKey()` helper rather than a hand-written template, so the
  files on disk can't drift from what the DTO derives.
- Insert one `ListingPhoto` row per listing (`photoNo: 1`) with a genuine dHash of the image
  bytes, matching what `UploadsController` would have stored.
- **No `PhotoVariantJob` rows** — variants already exist on disk. Enqueuing jobs would leave the
  photo-processing worker permanently retrying a fetch of originals that were never uploaded to R2.
- `apps/web/public/photos/` gets gitignored.

**Mobile caveat**: root-relative URLs don't resolve inside the native app. Testing photos on a
phone means pointing `CDN_BASE_URL` at the machine's LAN address (e.g.
`http://192.168.1.221:3000`) in `apps/bff/.env`.

## Script — `apps/bff/prisma/seedDemoListings.ts`

Kept **separate from `seed.ts`** (which stays as the small hand-written fixture set) and given its
own owner user, so the two never clobber each other and this one is independently re-runnable.

Flow:

1. `seedCities(prisma)` — reused as-is, guarantees cities/areas exist.
2. Upsert a dedicated `Demo Seed Owner` user (distinct phone from `seed.ts`'s `Seed Owner`).
3. Delete that owner's existing listings, capture their ids, and delete the matching files from
   `apps/web/public/photos/` — makes re-runs idempotent without touching anything else.
4. Generate the 7 category base images (both variants) into memory buffers + compute their dHashes.
5. Build all 1,554 listing rows, insert via `createManyAndReturn` (Prisma 7, Postgres) to get the
   generated ids back in one round trip.
6. `createMany` the `ListingPhoto` rows and write the image files, keyed by the returned ids.

### Field derivation (computed, not hand-written)

- **area** — rotates through the city's curated areas so listings spread across localities, which
  also gives the new `AreaFilter` something real to narrow.
- **price** — sampled from `PRICE_BOUNDS[category][sale|rental]` at roughly 5% / 15% / 35% of the
  band, so all three pass the moderation price-plausibility check *and* land in different
  `BrowseFilterBar` quick-pick brackets.
- **priceQualifier** — from `getPriceQualifierOptions(category, transactionType)`, so it can never
  fail the BFF's own `assertValidPriceQualifier`.
- **attributes** — every `required: true` field in `CATEGORY_FIELD_CONFIG` is filled, and optional
  ones are varied across the three records (e.g. furnishing unfurnished/semi/furnished) so facet
  filters have a distribution to bite on.
- **condition** — set on the column for furniture, mirroring `attributes.condition`.
- **title / slug / tag** — via the same `slugify` and `deriveTag` the real posting path uses, so
  seeded rows are indistinguishable from posted ones.

`deriveTag` is currently a private function inside `listings.service.ts`. It's extracted to
`packages/types/src/listingTag.ts` (alongside the existing `postingRules` / `priceQualifiers` /
`priceBounds` domain-rule modules) and imported by both the service and the seed, rather than
duplicated — importing the Nest service into a Prisma script would drag in the whole DI graph.

## Verification

- Row counts grouped by city / category / transactionType — every cell ≥ 3.
- Every listing has ≥ 1 `ListingPhoto`, and every derived variant URL has a matching file on disk.
- Browse pages render with images (not the `categoryImagePlaceholder` fallback).
- A previously-empty combination (e.g. house/lease, interiors/sell) now returns results.
- The area filter narrows within a city, and price quick-pick brackets are non-empty.
