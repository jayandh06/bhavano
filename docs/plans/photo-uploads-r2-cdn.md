# Photo uploads: size/type limits, resized variants, R2 storage + CDN

## Context

Before this change, the photo pipeline (`apps/bff/src/uploads/uploads.controller.ts`) was explicitly
marked `TEMP(auth-gate)`: a single photo per listing, written straight to local disk (`./uploads`,
backed by the `bff-uploads` Docker volume), served back via Nest's static-assets middleware, with an
8MB size cap and a loose `image/*` mimetype check (which also accepted things like `image/svg+xml`).
The original file was stored as-is and served as-is — no resizing, no format normalization.

This change: (1) tightens the upload contract (4MB max, JPEG/PNG/WebP/GIF only), (2) moves storage
to Cloudflare R2 with photos served through Cloudflare's CDN, (3) generates two resized/normalized
variants (`preview`, `full`) asynchronously after upload via a durable DB-backed job + in-process
poller (no new infra like Redis), and (4) extends the wizard to accept multiple photos per posting,
since the requested `<listingId>_<photoNo>_<type>` naming only means something once photoNo can be
more than 1.

**Confirmed decisions:**
- **Listing id is client-generated.** The wizard mints a UUID up front (before any upload) and
  sends it with every photo upload and the final create-listing call; the BFF uses it as the real
  `Listing.id`. This avoids a two-phase "upload to temp key, then rename to the real id" dance —
  keys are correct from the very first upload.
- **Async processing = a DB job table + in-process poller**, mirroring the durable-row pattern this
  codebase already uses for `RateLimitHit` (no in-memory queue, no new Redis/BullMQ dependency).
  `@nestjs/schedule`'s `@Interval()` drives a poller inside the existing BFF process.
- **Storage = Cloudflare R2** (S3-compatible API) with a custom-domain CDN in front of it — this app
  already lives entirely behind Cloudflare DNS, R2 has zero egress fees, and the same
  `@aws-sdk/client-s3` code would work unchanged against real S3 later if ever needed.
- **Multi-photo upload** is added to the wizard now (web + mobile), capped at 6 photos per posting.
- **Variant list is `preview` + `full` only** (matching what was asked); the config is a plain
  record so adding a third variant later is a one-line change, not a redesign.
- **Out of scope, explicitly:** editing/adding/removing photos after a listing is posted
  (`EditListingForm.tsx` has no photo UI and still doesn't); cleanup of orphaned uploads from
  abandoned wizard sessions (pre-existing characteristic of the prior system too); migrating
  existing listings' local-disk photo URLs into R2 — any listing created before this shipped lost
  its photo once local-disk serving was removed (no backfill script was written).

## Data model (`apps/bff/prisma/schema.prisma`)

Replaced `Listing.photos String[]` and the `PhotoHash` model with `ListingPhoto` (photoNo + hash,
ordered per listing) and `PhotoVariantJob` (the resize work queue: listingId, photoNo, ext, variant,
status, attempts, error — no FK to `Listing`, since jobs are only created once the listing already
exists, keeping the upload step, which runs before the listing exists, fully decoupled). `Listing`
gained `listingPhotos ListingPhoto[]`. Variant URLs are never stored — they're fully derived from
`listingId` + `photoNo` via the naming convention below, so there's nothing to keep in sync.
Migration: `20260718005656_add_listing_photos_and_variant_jobs` (additive tables/enums, drops the
old `photos` column and `PhotoHash` table — any pre-existing listing photos on local disk were lost,
per the explicit tradeoff above).

## Naming / URL convention (`apps/bff/src/uploads/photo-keys.ts`)

```ts
originalKey(listingId, photoNo, ext)      // photos/<listingId>_<photoNo>_original.<ext>
variantKey(listingId, photoNo, variant)   // photos/<listingId>_<photoNo>_<preview|full>.webp
variantUrl(cdnBase, listingId, photoNo, variant)
```

Variants are always re-encoded to WebP regardless of source format — `preview`: 480px wide, quality
70; `full`: 1600px wide max, quality 82 (`PHOTO_VARIANTS` config in the same file). GIF input is
accepted but variants are static (sharp reads the first frame) — a deliberate simplification, not a
bug, since animated thumbnails aren't meaningful for property/furniture photos. Originals are kept
(native ext, unresized) purely as the resize source — never exposed in any DTO.

## Storage layer (`apps/bff/src/storage/`)

`R2StorageService` (new `@aws-sdk/client-s3` dependency) wraps `PutObjectCommand`/`GetObjectCommand`
against R2's S3-compatible endpoint. Env vars (BFF only): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CDN_BASE_URL`.

## Upload endpoint (`apps/bff/src/uploads/uploads.controller.ts`)

`FileInterceptor` switched from `diskStorage` to `memoryStorage()`; `limits.fileSize` → 4MB;
`fileFilter` allowlists `image/jpeg|png|webp|gif` explicitly (closing off SVG as a side effect). New
`UploadPhotoDto` (`listingId` `@IsUUID()`, `photoNo` `@IsInt() @Min(1)`) validates the multipart
fields alongside the file. `computeDHash` now reads a `Buffer` instead of a file path. The handler
uploads the original to R2 and returns `{ hash, ext }` — **no job rows are created here**; enqueuing
resize work happens in `ListingsService.create()` instead, so abandoning the wizard mid-upload never
wastes worker cycles on a listing that's never posted.

## Async variant worker (`apps/bff/src/photo-processing/`)

New `@nestjs/schedule` dependency (`ScheduleModule.forRoot()` in `AppModule`). `PhotoProcessingService`
has `@Interval(3000) processPending()`: pulls up to 5 `pending` `PhotoVariantJob` rows, marks each
`processing`, downloads the original from R2, resizes+re-encodes via sharp, uploads the variant,
marks `done`. On failure: increments `attempts`, reverts to `pending` (retry) until 5 attempts, then
`failed` with the error message stored. An in-flight `running` flag skips overlapping ticks.

## Backend — listings (`apps/bff/src/listings/`, `apps/bff/src/moderation/`)

`CreateListingDto`/`CreateListingInput` gained `id: string` (`@IsUUID()`) and replaced
`photos?: string[]` / `photoHashes?: string[]` with `photos: { photoNo, hash, ext }[]`.
`ListingsService.create()` uses `input.id` as the Prisma primary key, derives photo hashes for
`ModerationService.moderate()`, and after the listing row is created inserts `ListingPhoto` rows
plus `PhotoVariantJob` rows (one per photo × variant). `update()`/`listMine()`/`getMine()`/browse
queries/etc. all now `include: { listingPhotos: { orderBy: { photoNo: 'asc' } } }`; `toCardDto`
builds `photos` (preview URLs) and `toDetailDto` additionally builds `photosFull` (full URLs), both
via `variantUrl(cdnBase, ...)` with `CDN_BASE_URL` read through `ConfigService`. `main.ts` no longer
serves `/uploads` as static assets; the `bff-uploads` Docker volume was removed.

## Shared types (`packages/types/src/index.ts`)

`ListingDetailDto` gained `photosFull: string[]`. `CreateListingInput` gained `id: string` and a
`CreatedPhotoInput { photoNo, hash, ext }` shape for `photos` (replacing `photos`/`photoHashes`).

## Frontend — web (`PostAdWizard.tsx`, `EditListingForm.tsx` untouched, `lib/bff.ts`,
`app/actions/listings.ts`) and mobile (`PostAdWizard.tsx`, `lib/bffClient.ts`)

Both wizards mint a client-side `listingId` (web: `crypto.randomUUID()`; mobile: `expo-crypto`'s
`randomUUID()`, already a project dependency) once per session, support selecting/removing up to 6
photos with client-side size/type pre-checks mirroring the server limits, upload each with its
`photoNo` on submit, and pass the collected `{photoNo, hash, ext}` array plus `id: listingId` to
`createListingAction`/`createListing`. Mobile's multi-select uses `expo-image-picker`'s
`allowsMultipleSelection`/`selectionLimit` (confirmed present in the installed v57 SDK types before
writing the code, per this app's `AGENTS.md` instruction to check current Expo APIs first).

## Frontend — rendering

`ListingCard.tsx` (web + mobile) and the listing detail pages (web + mobile) previously didn't
render `item.photos` at all (placeholder gradient + `imgLabel` only). Added minimal `<img>`/`Image`
rendering using `photos[0]` (cards) and `photosFull` (detail page gallery strip) with the placeholder
kept as a fallback for zero-photo listings.

## Deployment (`docs/deployment.md`, `docker-compose.prod.yml`, `.env.production.example`)

Added a "Photo storage (Cloudflare R2 + CDN)" section covering bucket creation, API token
generation, and binding a custom domain (e.g. `cdn.bhavano.com`) via the Cloudflare dashboard (no
Caddy config needed — R2 custom domains are served directly by Cloudflare's edge). `docker-compose.prod.yml`'s
`bff` service gained the five `R2_*`/`CDN_BASE_URL` env vars and lost its `bff-uploads` volume mount.

## Verification

- `pnpm --filter @bhavano/types build && pnpm typecheck` — all 5 packages pass.
- BFF: a photo-less create → 400; an oversized/wrong-type upload → 400; a valid upload → `{hash,
  ext}`; creating a listing with N photos → N `ListingPhoto` rows + 2N `PhotoVariantJob` rows,
  reaching `done` within a few poller ticks, with objects appearing in R2 at the predictable keys.
- Web/mobile: post a listing with multiple photos, confirm add/remove works pre-submit and the
  listing card + detail page show real photos shortly after posting.
