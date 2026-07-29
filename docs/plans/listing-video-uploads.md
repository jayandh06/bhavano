# Video uploads for listings, tiered by Agent Pro / boost status

## Context

Bhavano listings currently support photos only. The ask: let sellers attach video to a listing,
with different limits for free/individual sellers vs. two existing premium mechanisms —
**Agent/Broker Pro** subscribers (`User.agentProUntil`) and **boosted listings**
(`Listing.boostedUntil`) — rather than adding a new tier concept. Confirmed limits:

| Tier | Max videos | Max duration each |
|---|---|---|
| Default (no active Agent Pro, listing not boosted) | 1 | 30s |
| Elevated (active Agent Pro **or** this listing is boosted) | 3 | 120s |

Agent Pro sellers get the elevated tier automatically, account-wide. Individual sellers only get
it by boosting that specific listing — since boosting happens **after** a listing is created
(via the existing `BoostButton`), this is the first feature in the codebase where a seller needs
to attach media to a listing *after* creation. Photos today are fully immutable post-creation;
video breaks that, deliberately, only for video.

This plan was produced after three parallel research passes over the existing photo-upload
pipeline (`apps/bff/src/uploads/`, `apps/bff/src/photo-processing/`), the premium/subscription
system (`apps/bff/src/payments/`, `apps/bff/src/rate-limit/`), and the listing creation/moderation
flow (`apps/bff/src/listings/`), followed by a dedicated design-review pass that caught four
blockers in the first-draft design (see "Rejected approaches" at the end). What follows is the
refined design.

## Key architectural decisions

1. **`storageId`, not `videoNo`, in R2 keys.** Cloudflare's CDN sits directly on the R2 bucket with
   no app-level serving and no cache-purge hook. If a delete+re-add ever reused a key (e.g. from
   `videoNo`), the edge could keep serving a video the seller explicitly deleted. An opaque,
   server-minted `storageId` makes every key write-once forever, so deletion is always safe — this
   is the property photos get "for free" only because they're immutable.
2. **One `ListingVideo` row carries its own processing status** — unlike photos'
   `ListingPhoto` + separate `PhotoVariantJob`. That split exists for photos because the upload
   step runs before the listing exists; every video attach path (wizard or post-creation) runs
   *after* the listing row already exists, so there's nothing to decouple, and splitting would mean
   downloading + decoding a ~100MB+ original twice (once per variant) instead of once.
3. **Entitlement is enforced on write only, never retroactively.** If a boost expires with 3
   videos already attached, all 3 stay visible and playable forever — consistent with every other
   tier mechanism in this codebase (rate-limit bypass, boost ranking, Plus features), none of which
   claw back anything already granted.
4. **`create()` never rejects a listing over video.** Photos are required — a photo-less listing
   is worthless, so that still hard-fails. Video is additive: if entitlement lapses between upload
   and submit, the extra/over-length videos are silently trimmed, not the whole submission.
5. **Video upload goes browser → BFF directly**, not through a Next.js Server Action. Server
   Actions have a 1MB default body limit (`apps/web/next.config.ts` doesn't raise it) — video
   cannot use the path photos use at all. Same pattern already exists for the WebSocket connection
   (`apps/web/src/lib/socket.ts`, explicitly commented as "a deliberate, narrow exception to 'no
   direct browser->BFF calls'"); video upload becomes the second such exception.
6. **A single flat byte ceiling (200MB), not a per-tier one.** Multer's `FileInterceptor` is
   configured at class-decoration time, before any request or user is known — a per-tier cap can't
   be expressed at the layer that actually needs to enforce it. Tier is enforced on **duration**
   (the real product rule) plus one flat size ceiling that bounds abuse regardless of tier.
7. **Full transcode + poster frame, one ffmpeg pass, on the BFF's existing t4g.medium ARM64 box.**
   No hardware acceleration on Graviton2 — pure software libx264, single-threaded, capacity-budgeted
   below.

## Schema (`apps/bff/prisma/schema.prisma`)

Add `listingVideos ListingVideo[]` next to `listingPhotos` on `model Listing` (line 200).

```prisma
enum VideoStatus {
  pending
  processing
  done
  failed
}

/** One uploaded video per row, carrying its own processing state — deliberately not split into a
 * separate job table the way ListingPhoto/PhotoVariantJob are (see plan doc: every attach path
 * here runs after the Listing row already exists, so there's nothing to decouple, and one video's
 * transcode + poster frame come from one decode pass, not two). */
model ListingVideo {
  id          String      @id @default(cuid())
  listingId   String
  listing     Listing     @relation(fields: [listingId], references: [id], onDelete: Cascade)
  /** Display order only — never appears in a storage key. */
  videoNo     Int
  /** Opaque, server-minted, the ONLY identifier in the R2 key — keeps keys write-once even though
   * videos are deletable, so a delete + re-add can never resolve to a CDN-cached stale key. */
  storageId   String      @unique
  ext         String
  /** ffprobe-verified server-side, never client-reported — this is the tier-enforcement value. */
  durationSec Int
  sizeBytes   Int
  status      VideoStatus @default(pending)
  attempts    Int         @default(0)
  error       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([listingId, videoNo])
  @@index([status, createdAt])
  @@index([listingId])
}
```

Generate the migration the repo's documented non-interactive way (`docs/deployment.md`'s
`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` +
hand-created migration folder — `prisma migrate dev` refuses to run non-interactively here).

## Storage keys — new `apps/bff/src/uploads/video-keys.ts`

```ts
export const VIDEO_TRANSCODE = { maxLongEdge: 1280, videoBitrateK: 1800, audioBitrateK: 96, crf: 26 } as const;
export const POSTER_WIDTH = 720;
export const POSTER_QUALITY = 76;

// Own prefix so an R2 lifecycle rule can expire originals by prefix (rules only filter on prefix).
export function videoOriginalKey(listingId: string, storageId: string, ext: string): string {
  return `videos/originals/${listingId}/${storageId}.${ext}`;
}
export function videoTranscodedKey(listingId: string, storageId: string): string {
  return `videos/${listingId}_${storageId}_720p.mp4`;
}
export function videoPosterKey(listingId: string, storageId: string): string {
  return `videos/${listingId}_${storageId}_poster.webp`;
}
export function videoUrl(cdnBase: string, listingId: string, storageId: string): string {
  return `${cdnBase}/${videoTranscodedKey(listingId, storageId)}`;
}
export function videoPosterUrl(cdnBase: string, listingId: string, storageId: string): string {
  return `${cdnBase}/${videoPosterKey(listingId, storageId)}`;
}
```

**Original retention: 7 days via an R2 object-lifecycle rule** on the `videos/originals/` prefix
(Cloudflare dashboard → bucket → Settings → Object lifecycle rules), not application code. There is
no media cleanup anywhere in this codebase today (`R2StorageService` has no `deleteObject`) —
photos survive that because they're tiny; a 200MB original per video is real, permanent storage
growth otherwise. 7 days covers the processing retry window (3 attempts) with room to spare for
manual debugging. Document the rule in `docs/deployment.md` next to the existing R2 setup steps —
it's invisible infra a future dev won't otherwise know exists.

Add `putObjectStream(key, filePath, contentType)`, `getObjectToFile(key, filePath)`, and
`deleteObject(key)` to `R2StorageService` (`apps/bff/src/storage/r2-storage.service.ts`, currently
only `putObject`/`getObject` on in-memory `Buffer`s). `ContentLength` must be passed explicitly on
the stream upload (`fs.stat` the file first) — without it, the AWS SDK falls back to
`aws-chunked` transfer encoding, which R2 rejects.

## Entitlement — `packages/types/src/videoLimits.ts` (new)

```ts
export const VIDEO_LIMITS = {
  default:  { maxVideos: 1, maxDurationSec: 30 },
  elevated: { maxVideos: 3, maxDurationSec: 120 },
} as const;

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_UPLOADS_PER_DAY = 12;

export interface VideoEntitlement {
  maxVideos: number;
  maxDurationSec: number;
  /** Drives the "Boost this listing to add up to 3 videos…" upsell — true only when the caller
   * is on the default tier and boosting *this* listing would lift them. */
  canUpgradeByBoosting: boolean;
}

function isActive(until: Date | string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now();
}

/** Pass `listing` undefined at wizard time (it doesn't exist yet, so only Agent Pro can elevate).
 * This is the codebase's first isPremium()-shaped helper — keep its scope to this feature; don't
 * refactor the existing inline `agentProUntil?.getTime() ?? 0 > Date.now()` call sites elsewhere. */
export function resolveVideoEntitlement(
  user: { agentProUntil?: Date | string | null },
  listing?: { boostedUntil?: Date | string | null } | null,
): VideoEntitlement {
  const elevated = isActive(user.agentProUntil) || isActive(listing?.boostedUntil);
  return elevated
    ? { ...VIDEO_LIMITS.elevated, canUpgradeByBoosting: false }
    : { ...VIDEO_LIMITS.default, canUpgradeByBoosting: true };
}
```

This mirrors how `boostPricing.ts`/`postingRules.ts`/`priceBounds.ts` already put shared business
rules in `packages/types` so web/bff/admin/mobile share one implementation. **Read paths must never
filter by entitlement** (point 3 above) — only write paths call this.

## BFF endpoints

| Endpoint | Guards | Body | Returns |
|---|---|---|---|
| `POST /uploads/video` (new) | `AuthGuard` | multipart: `file`, `listingId` | `{ storageId, ext, durationSec, sizeBytes }` |
| `POST /listings` (existing) | `AuthGuard`, `RateLimitGuard('publish')` | `+ videos?: CreatedVideoInput[]` | `ListingDetailDto` |
| `POST /listings/:id/videos` (new) | `AuthGuard` | multipart: `file` | `ListingDetailDto` |
| `DELETE /listings/:id/videos/:videoId` (new) | `AuthGuard` | — | `ListingDetailDto` |

`CreatedVideoInput = { storageId, ext, durationSec }` — no `videoNo`; the wizard's array order
becomes `videoNo` server-side in `create()`. The post-creation add path is a **single multipart
request**, not photos' upload-then-attach two-step — that split only paid for itself while the
listing didn't exist yet (per point 2), and here it would force reserving a `videoNo` before the
upload commits.

### `POST /uploads/video` (`apps/bff/src/uploads/uploads.controller.ts` or a new sibling controller)

- `Multer` `diskStorage` (not `memoryStorage` — 200MB in a Buffer plus the SDK's internal copy is
  too much RSS on a 4GB box, and `ffprobe` wants a file path), writing into a dedicated temp dir.
- MIME allowlist is a first-pass filter only, **not the security boundary**: accept
  `video/mp4, video/quicktime, video/webm, video/3gpp, video/x-matroska, application/octet-stream`
  (real-world Android/Safari pickers send inconsistent types for the same file) — **`ffprobe` is
  the authoritative validator**.
- Look up `listingId` if the client sent one that already exists: if found, ownership check +
  resolve entitlement *with* the listing (boost matters); if not found, wizard path, resolve with
  user only. This is the primary quota gate — `POST /listings` becomes a cheap re-check.
- Run `ffprobe -v quiet -print_format json -show_format -show_streams <path>` (15s timeout).
  Reject if no video stream exists (catches an audio file renamed `.mp4`). Duration =
  `Math.ceil(max(format.duration, videoStream.duration))`; reject if not a finite positive number,
  or if it exceeds the absolute 120s ceiling, or the caller's actual tier limit.
- Upload the original to R2 via `putObjectStream`, **then delete the local temp file before
  responding** — do not hand the temp file to the worker. The worker re-downloading from R2 is
  what makes its retry logic (and a container restart mid-flow) safe, exactly like photos already
  rely on. R2 egress is free, so the extra GET costs nothing meaningful.
- **Guard rails** (new `apps/bff/src/uploads/video-upload.guard-rails.ts` or controller-local):
  in-process semaphore capping concurrent video uploads at 2 (503 + `Retry-After` beyond that,
  matching the codebase's existing single-instance assumption — `PhotoProcessingService`'s
  in-memory `running` flag sets the same precedent); a free-disk-space precheck
  (`fs.statfs(tmpDir)`, reject if <2GB free — the whole 20–30GB root volume is shared with Docker
  images, Loki, Grafana, and BFF logs per `docs/deployment.md`); a `MAX_VIDEO_UPLOADS_PER_DAY = 12`
  per-user check (`count(ListingVideo where listing.ownerId = me and createdAt > now-24h)`); a
  `@Interval(600_000)` sweeper deleting any temp file older than 30 minutes as a crash backstop.

### `ListingsService.create()` (`apps/bff/src/listings/listings.service.ts:325`)

After the existing photo/moderation checks, before the `prisma.listing.create()` call:

```ts
// Video never blocks a post — trim silently rather than reject the whole listing, since
// entitlement (agentProUntil) can lapse between the uploads and this call and video is optional.
const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { agentProUntil: true } });
const entitlement = resolveVideoEntitlement(owner); // no listing yet — Agent Pro only
const acceptedVideos = (input.videos ?? [])
  .filter((v) => v.durationSec <= entitlement.maxDurationSec)
  .slice(0, entitlement.maxVideos);
```

Then, mirroring the existing `listingPhoto.createMany`/`photoVariantJob.createMany` block
(lines 357–365): create one `ListingVideo` row per accepted video (`videoNo = index+1`,
`status: pending`) — no separate job-table insert since status lives on the row.

### New `addVideo()` / `deleteVideo()` on `ListingsService`

- `addVideo(listingId, ownerId, { storageId, ext, durationSec })`: ownership check
  (`ForbiddenException`, same pattern as `getMine()` at line 395), re-fetch the listing, resolve
  entitlement *with* it, reject (400, with the upsell copy below) if
  `existingCount >= maxVideos || durationSec > maxDurationSec`. Allocate `videoNo` as
  `max(existing videoNo) + 1`, retry once on a `@@unique([listingId, videoNo])` P2002 (two
  concurrent adds from a double-click is the entire race to worry about — no transaction/locking
  needed). Since `videoNo` never appears in a storage key, reuse after a delete is harmless.
  Returns the refreshed `ListingDetailDto` (including recomputed `videoEntitlement`) so the client
  re-renders from one authoritative payload.
- `deleteVideo(listingId, ownerId, videoId)`: ownership check, delete the row immediately
  regardless of current entitlement (never gate a delete on quota — a lapsed-and-over-quota owner
  must still be able to remove one), fire-and-forget `deleteObject` for the transcoded file + the
  poster (harmless if it fails, thanks to opaque keys).
- **Upsell copy** (used both server-side in the 400 message and client-side pre-check):
  - default tier, under cap → allow.
  - default tier, at cap, `canUpgradeByBoosting` → *"Boost this listing to add up to 3 videos, up
    to 2 minutes each."* + link to the existing `BoostButton` flow.
  - elevated tier, at cap (3/3) → *"You've added the maximum of 3 videos. Delete one to add
    another."*
  - lapsed (e.g. 3 videos present, current limit 1) → same "maximum" copy, never a confusing
    "limit is 1" message when 3 are already visible.

### `toDetailDto`/`toCardDto` (`listings.service.ts:590`/`631`)

- `ListingDetailDto` gains `videos: ListingVideoDto[]`, filtered to `status === 'done'` for
  non-owners/non-admins (a `<video>` must never point at an object that doesn't exist yet) —
  owners/admins see all statuses so the UI can show "Processing…". Also gains
  `videoEntitlement?: VideoEntitlement`, populated only when `isOwnerOrAdmin` (reuses the check
  already at line 316) — the client must never recompute this itself from a possibly-stale
  `agentProUntil`, so every upsell string is a pure function of one server-provided value.
- `ListingCardDto` gains only `hasVideo: boolean` (not the full array — browse pages render 20+
  cards with no video player). Requires widening `toCardDto`'s include to add
  `listingVideos: { where: { status: 'done' }, select: { id: true }, take: 1 }` on every call site
  that lists cards (`list()`, `listMine()`, etc.) — the type system will flag any that's missed.

## Async worker — `apps/bff/src/video-processing/` (new module, mirrors `photo-processing/`)

`VideoProcessingService`, `@Interval(10_000)` (photos poll every 3s; transcoding is far more
CPU-expensive, so this is deliberately slower), batch of 1 (serialize — don't contend for the
box's 2 vCPUs), `MAX_ATTEMPTS = 3` (transcode failures are typically deterministic — a bad/corrupt
input — so more retries just waste credits).

Per pending `ListingVideo`: mark `processing` → `getObjectToFile` the original into a temp file →
run one `ffmpeg` invocation producing both the transcoded MP4 and a poster PNG in a single pass
(see command below) → re-encode the poster PNG to WebP via the already-used `sharp`
(`POSTER_WIDTH=720`, `quality=76`) → `putObjectStream` both outputs to R2 → mark `done`. On
failure, increment `attempts`; `failed` + stderr tail in `error` after `MAX_ATTEMPTS`. `try/finally`
temp-file cleanup on every path (the sweeper above is the crash-only backstop).

```
ffmpeg -nostdin -y -loglevel error -nostats -i <input> -t 130
  -map 0:v:0 -map 0:a:0?
  -vf scale=w=1280:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2
  -c:v libx264 -preset veryfast -crf 26 -maxrate 1800k -bufsize 3600k
  -pix_fmt yuv420p -profile:v main -level 4.0 -movflags +faststart
  -c:a aac -b:a 96k -ac 2 -threads 1
  <out.mp4>
```
then a second pass (or a second output in the same invocation) extracting one frame at
`min(1, durationSec/2)` seconds to PNG for the poster.

Non-obvious flags, each fixing a real failure mode: `-movflags +faststart` (otherwise the browser
must download most of the file before playback starts — the difference between "plays" and
"spins forever" on a slow mobile connection); `scale=...force_divisible_by=2` (portrait phone video
is the common case; `yuv420p` hard-errors on odd dimensions); `-t 130` (a crafted container can lie
about duration in its own metadata — this hard-caps actual transcode work regardless); `-map
0:a:0?` (the `?` makes audio optional — silent walkthrough videos are common and would otherwise
fail outright); `-pix_fmt yuv420p -profile:v main` (iPhone HEVC is often 10-bit/HDR; Alpine's ffmpeg
has no tone-mapping, so forcing 8-bit main profile trades a minor color shift for universal
`<video>` compatibility).

Use `child_process.spawn` (not `execFile` — its default 1MB `maxBuffer` is a footgun against
ffmpeg's stderr), with an explicit 240s wall-clock timeout that sends `SIGKILL` (ffmpeg can hang
uninterruptibly on a malformed input; `SIGTERM` isn't reliable there), `os.setPriority(pid, 10)`
right after spawn so a transcode never starves the Node event loop, and `-threads 1` in the ffmpeg
invocation itself.

**Capacity note for `docs/deployment.md`**: t4g.medium is CPU-credit burstable (~24 credits/hour
surplus). A 120s 1080p→720p `libx264 veryfast` single-threaded transcode costs roughly 1–2 credits.
That's comfortably ~100–200 videos/day sustained before credits deplete and throttle the *whole
instance* (Caddy/web/admin included, not just video) — fine at launch, worth a CloudWatch
`CPUCreditBalance` alarm before any real volume.

## Docker / infra changes

- `apps/bff/Dockerfile`: add `ffmpeg` to the **`runner` stage only** (not `base`, which `pruner`/
  `installer` also inherit and don't need it) with a build-time assert so a missing binary surfaces
  at image-build time, not on the first production upload:
  ```dockerfile
  RUN apk add --no-cache ffmpeg && ffmpeg -version && ffprobe -version
  ```
- Reuse the already-created-but-unused `/app/apps/bff/uploads` directory (a leftover from the
  pre-R2 local-disk era) as the video temp dir; give it a dedicated named volume in
  `docker-compose.prod.yml` (`bff_video_tmp`) so a container restart doesn't strand temp files in
  the writable layer. Not `tmpfs` — that's RAM-backed, and 4GB total is already shared with
  Node/Next.js/Loki/Grafana/Caddy.
- `Caddyfile` (and `Caddyfile.local`) — add an explicit body-size cap on the API site block so an
  oversized upload 413s at the edge instead of streaming fully into the BFF first:
  ```
  {$API_DOMAIN} {
      request_body { max_size 210MB }
      reverse_proxy bff:4000
  }
  ```
  Caddy has no default limit (unlike nginx's 1MB default), so nothing is currently broken here —
  this is a hardening addition, not a fix.
- Configure the R2 lifecycle rule on `videos/originals/` (7-day expiry) in the Cloudflare
  dashboard — no code, but document the step in `docs/deployment.md`.

## Web client

- **New `apps/web/src/lib/videoUpload.ts`** (kept out of `lib/bff.ts`, which is `import
  "server-only"`) — `uploadVideoDirect(file, listingId, accessToken, onProgress)` and
  `addVideoToListing(...)`, both hitting `NEXT_PUBLIC_BFF_URL` directly via `XMLHttpRequest` (not
  `fetch` — only `XHR` exposes `upload.onprogress`, and a multi-minute upload with zero feedback on
  a slow connection is a real problem, not polish). CORS is already permissive enough
  (`main.ts`'s `enableCors({ origin: true, credentials: true })`). Before starting, check
  `isAccessTokenValid` (`apps/web/src/lib/session.ts`) — the BFF token's 1h TTL means a long upload
  started near expiry would otherwise 401 after fully transferring; fail fast instead with "session
  expired, sign in again."
- **`PostAdWizard.tsx`**: a video picker alongside the existing photo picker in the "details" step.
  Client-side duration pre-check via a hidden `<video>` + `loadedmetadata`, but treated as a
  courtesy only — if `video.duration` isn't a finite positive number (happens with some WebM/HEVC
  sources), let the upload proceed and rely on server-side `ffprobe`, never block a possibly-valid
  file on a browser parsing quirk. On submit, upload each video via `uploadVideoDirect` (mirroring
  the sequential photo-upload loop) and include the resulting `{storageId, ext, durationSec}[]` in
  `CreateListingInput.videos`.
- **Post-creation add/delete UI**: on the wizard's "success" step (next to the existing
  `BoostButton`) and on `my-listings`/the owner's listing-detail view — an "Add video" affordance
  that shows the upsell copy from `resolveVideoEntitlement` (via `videoEntitlement` on the fetched
  listing) when at cap, otherwise lets the owner pick a file → `addVideoToListing`. A delete
  control per video, always available regardless of current entitlement.
- **`ListingDetailView.tsx` / new `ListingMediaGallery.tsx`**: keep `ListingDetailView` a server
  component; extract gallery interaction into a new client component. Index 0 stays the existing
  `priority` `next/image` (the page's LCP element — this is Bhavano's highest-traffic,
  SEO-load-bearing page, so a hero `<video>` is off the table). The currently-inert thumbnail strip
  gains click-to-select; video thumbnails show the poster + a duration chip, and selecting one
  swaps the hero to `<video controls poster={posterUrl} preload="none" playsInline>` —
  `preload="none"` and no autoplay are mandatory (autoplay/`preload="metadata"` would mean paying
  bandwidth on every crawl/bounce for every detail-page view). Add `VideoObject` JSON-LD (mirroring
  the existing `apps/web/src/lib/faqJsonLd.ts` pattern) for video rich-result eligibility.
- **Mobile (`apps/mobile`) is explicitly out of scope for this pass.** Every new/changed type field
  is optional (`videos?`, `hasVideo?`, `videoEntitlement?`) so mobile's existing screens and
  `bffClient.ts` stay untouched and green. One small addition worth including: if `hasVideo` on the
  mobile listing-detail screen, show "📹 This listing has a video — view on the web" rather than
  silently hiding paid-for content.

## Admin

`apps/admin/src/app/listings/[id]/page.tsx` already renders `photosFull` in a plain `<img>` grid for
the human moderation queue (deliberately not `next/image`, per its own comment). Add videos there
too (poster + inline player) — there's no automated content moderation for photos either (no NSFW
scan, only a perceptual-hash dedup that doesn't extend to video), so this human queue is the only
moderation video gets, matching photos' existing posture. The existing `flag()` takedown already
hides an entire listing including any videos (via `findOne()`'s 404-for-non-owners on
`moderationState: 'flagged'`), so no separate video-specific takedown mechanism is needed.

Duplicate-photo detection is explicitly **not** extended to video — the dHash approach doesn't
apply, and `ModerationService.hasDuplicatePhoto` already does an unbounded in-memory scan of every
`ListingPhoto` row per create (its own code comment admits this won't scale); adding a second
such scan isn't worth it for this feature.

## Verification

1. **Infra first, before any TypeScript**: build the `bff` image locally
   (`docker compose build bff`) and confirm `ffmpeg -version`/`ffprobe -version` succeed inside it —
   the only step here with real infra risk (arm64 codec/package availability).
2. `pnpm --filter @bhavano/bff prisma:generate` after the migration, `pnpm -w typecheck` clean
   across all packages (this will surface every `toCardDto`/`toDetailDto` call site that needs the
   new `listingVideos` include, by design).
3. Manual end-to-end locally (`pnpm dev`): post a new listing with 1 video as a plain user →
   confirm it's capped at 30s/1 video client- and server-side; confirm the video shows
   "Processing…" then plays with a poster once the worker finishes (watch `VideoProcessingService`
   logs). Repeat as an Agent Pro seeded user (or a boosted listing) → confirm 3×120s is accepted.
4. Try to add a 4th video on an elevated-tier listing → 400 with the "maximum of 3" copy. Delete a
   video, confirm the detail page/CDN never serves the deleted content (this is the one test that
   directly validates the opaque-`storageId` decision).
5. Force an oversized (>200MB) and a too-long (>120s) upload → confirm rejection at the upload
   endpoint, not deep inside listing creation.
6. Confirm `docker compose -f docker-compose.prod.yml exec bff npx prisma migrate deploy` cleanly
   applies the new migration before deploying to EC2, per the existing runbook in
   `docs/deployment.md`.
7. After user approval of this plan, save a permanent copy to `docs/plans/listing-video-uploads.md`
   per this repo's CLAUDE.md convention, before starting implementation.

## Rejected approaches (from the initial draft, kept for context)

- **Mirroring `ListingPhoto` + a separate `VideoProcessingJob` table 1:1** — rejected because it
  would double the most expensive operation in the system (downloading + decoding the original
  once per variant instead of once) and risks orphaned jobs writing orphan R2 objects on delete.
- **`videoNo` in the storage key** — rejected due to CDN cache-poisoning risk on delete+re-add
  (Cloudflare's edge cache can't be purged from application code here).
- **Per-tier multer `fileSize` limits** — rejected as structurally unimplementable (the interceptor
  is built before the request/user is known); replaced with one flat ceiling + tier-scoped duration
  checks.
- **Video upload via a Next.js Server Action** (photos' path) — rejected due to the 1MB default
  body-size limit; replaced with a direct browser→BFF `XMLHttpRequest`, matching the existing
  Socket.IO direct-connection precedent.
- **Deleting the original from R2 immediately after a successful transcode** — rejected in favor of
  a time-based R2 lifecycle rule, so cleanup isn't coupled to a code path that can fail and a
  short debug window survives a transcode that "succeeded" but looks wrong.
- **Retroactively hiding videos when a boost/Agent-Pro subscription lapses** — rejected as
  inconsistent with every other tier mechanism in the codebase (none of which claw back anything),
  and likely to read as a bug to a returning buyer.
