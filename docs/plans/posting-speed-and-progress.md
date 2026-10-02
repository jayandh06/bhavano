# Speed up ad posting (photo/video upload) and show real progress

## Context

Posting an ad sometimes feels slow, and the wizard gives no feedback on why — the Submit button
just says "Posting…" the whole time, on both web and mobile. Confirmed by reading the actual
upload code (not guessing): server-side processing (watermarking, resizing, video transcoding) is
**already asynchronous** — `createListingAction` returns as soon as the listing row exists, and a
`PhotoVariantJob`/`ListingVideo` queue finishes variants/transcoding in the background afterward
without blocking the user. The real wait is **sequential raw-byte upload**: every photo uploads
one at a time, then every video uploads one at a time, each fully awaited before the next starts
(`apps/web/src/components/home/PostAdWizard.tsx:1278-1337`). Mobile has the identical shape
(`apps/mobile/src/components/home/PostAdWizard.tsx:1170-1187`).

Two additional, load-bearing facts found while verifying this:

- **Photos take a double hop** today: browser → Next.js Server Action (`uploadPhotoAction`,
  `apps/web/src/app/actions/listings.ts:73`) → `fetch` to the BFF (`apps/web/src/lib/bff.ts:529`).
  This is deliberate (`next.config.ts:15` sets `serverActions.bodySizeLimit: "12mb"` specifically
  for this), not an oversight — and it's *why* photos have no upload-progress events at all: `fetch`
  has no upload-progress API, full stop, regardless of hop count.
- **Video uploads already use direct XHR** (`apps/web/src/lib/videoUpload.ts`) specifically to get
  `xhr.upload.onprogress` — it even accepts an `onProgress` callback already — but the wizard's call
  site never passes one (`PostAdWizard.tsx:1328`). It's one argument away from working.
- **The BFF caps concurrent video uploads at 2, globally, across every user** — an in-process
  semaphore (`apps/bff/src/uploads/video-upload.guard-rails.ts`, `MAX_CONCURRENT_VIDEO_UPLOADS = 2`)
  that immediately 503s anything beyond it. `videoUpload.ts`'s existing retry logic only retries a
  connection-level `xhr.onerror`, **not** an HTTP 503 — so this cap directly bounds how much video
  concurrency is safe to add, and retrying 503 becomes necessary the moment any client-side video
  concurrency is added (today, strictly sequential single uploads almost never hit it).

No existing plan doc covers this (checked `docs/plans/`) — `listing-video-uploads.md` documents the
async job-queue architecture and the direct-XHR rationale, but nothing about parallel uploads or
progress UI.

## Decisions made (so the plan can move; flag at review if any should go the other way)

- **Progress UI is inline text next to/inside the existing Submit button**, not a modal or a new
  step-overlay — matches this app's existing minimal-UI convention (every other wizard status is an
  inline message), and a richer overlay is a pure visual upgrade later if wanted, not a redo.
- **Concurrency is 3 for photos, 2 for video** — not arbitrary: 3 covers the 6-photo cap
  (`MAX_PHOTOS`, `packages/types/src/photoLimits.ts`) in two waves, and 2 exactly matches the BFF's
  existing global video-upload semaphore (`MAX_CONCURRENT_VIDEO_UPLOADS`) — going higher there only
  trades client-side parallelism for more server-side 503s.
- **Photos stay on the Server Action path for now** (concurrency only, no byte-level progress) —
  moving them to direct XHR (like video) would add real byte-level progress per photo, but photos
  are already pre-shrunk to ≤1.5MB and typically upload in a second or two each, so a "photo 2 of 5"
  counter captures nearly all the user-facing value for much less churn. Noted as a clean future
  phase if photo-specific progress fidelity turns out to matter.
- **Client-side video compression is explicitly out of scope** — a materially bigger lift (WASM/
  WebCodecs, bitrate/quality tuning, real CPU/battery risk on low-end phones, interaction with the
  existing server-side transcode pipeline) that deserves its own plan if upload-time telemetry after
  this change shows video size, not sequential uploading, is still the dominant cost.
- **Web ships first, mobile is a fast-follow** — validates the concurrency numbers and the new
  503-retry behavior against real traffic before a second client adds the same load pattern.

## Approach

### Phase 1 — Web: show real progress on the existing upload path (no mechanics changes)

Lowest-risk, ships independently of the phases below.

- `apps/web/src/components/home/PostAdWizard.tsx`: add
  `const [uploadProgress, setUploadProgress] = useState<{ phase: "photos" | "video" | "creating"; current: number; total: number; fraction?: number } | null>(null)`.
  - Photo loop (~1278-1313): `setUploadProgress({ phase: "photos", current: photoNo, total: photos.length })` per photo.
  - Video loop (~1325-1337): pass a 4th argument to `uploadVideoDirect` —
    `(fraction) => setUploadProgress({ phase: "video", current: i + 1, total: videos.length, fraction })`.
    This is the one-line fix for the dropped callback noted above.
  - Around `createListingAction`: `setUploadProgress({ phase: "creating", current: 1, total: 1 })`.
  - Replace the static `pending ? "Posting…" : …` text (~2036) with text driven by `uploadProgress`:
    "Uploading photo 2 of 5…", "Uploading video… 43%", "Creating listing…".

### Phase 2 — Web: parallel photo uploads

- New **`packages/types/src/concurrencyPool.ts`**: a small, framework-agnostic
  `runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>`
  — fits the existing pattern of pure, cross-app helpers already in `packages/types/src`
  (`photoLimits.ts`, `videoLimits.ts`), importable from both `apps/web` and `apps/mobile` with no
  new dependency (no `p-limit`-style package is in the repo today, and this is small enough not to
  need one).
- Replace the sequential photo `for` loop with `runWithConcurrency(photos, 3, …)`, keeping
  `photoNo = i + 1` assigned from the original index (not completion order), writing into a
  pre-sized results array so order is preserved regardless of which upload finishes first.
- **Preserve today's "stop on first photo failure" behavior as closely as a pool allows**: don't
  start a new wave once a failure is detected, and surface the same error UI as today. Exactly
  zero extra uploads past a failure isn't achievable with in-flight concurrent requests (a couple
  from the same wave may already be in transit) — worth stating plainly rather than silently
  changing the guarantee.

### Phase 3 — Web: parallel video uploads + retry the one new failure mode it creates

- Replace the video `for...of` loop with `runWithConcurrency(videos, 2, …)` — video failures are
  already independently non-fatal (today's `try/catch` continues past a failed video), so no
  ordering/abort nuance here.
- In `apps/web/src/lib/videoUpload.ts`'s `xhrJsonOnce`/`xhrJson`: also treat an HTTP 503 as
  retryable (currently only `xhr.onerror`/`TransientUploadError` retries). Required *because* of
  this phase: concurrency of exactly 2 can now collide with another user's upload against the
  BFF's global cap of 2 (`MAX_CONCURRENT_VIDEO_UPLOADS`, `apps/bff/src/uploads/video-upload.guard-rails.ts`),
  where today's strictly-sequential single uploads almost never do.
- Real-world impact is modest (most listings carry 0-1 video) — included for consistency and
  because skipping the 503 retry fix while adding concurrency would be a net-new regression.

### Phase 4 — Mobile fast-follow (after web ships, same approach)

- `apps/mobile/src/lib/bffClient.ts`: port `uploadPhoto`/`uploadVideo` (currently plain `fetch`,
  no progress) to `XMLHttpRequest`-based versions exposing `onProgress` — a direct port of web's
  `videoUpload.ts` shape, since RN's XHR supports `xhr.upload.onprogress` the same way.
- Import the same `runWithConcurrency` from `packages/types/src/concurrencyPool.ts`; apply
  concurrency 3/2 at the same two loop sites
  (`apps/mobile/src/components/home/PostAdWizard.tsx:1170` photos, `:1181` video).
  Replace the bare `ActivityIndicator` with the same progress text pattern as web.

## Not doing (this pass)

- Byte-level photo progress (moving photos off the Server Action path onto direct XHR) — clean
  future phase, not required for the stated goal.
- Client-side video compression before upload — separate, larger plan if later telemetry calls for it.
- Any change to server-side processing (watermarking, variant generation, transcoding) — already
  async and already doesn't block publish; not the bottleneck.

## Critical files

- `apps/web/src/components/home/PostAdWizard.tsx` — progress state, both upload loops, button text.
- `apps/web/src/lib/videoUpload.ts` — 503 added to the retryable set.
- `packages/types/src/concurrencyPool.ts` (new) — shared pool helper, web + mobile.
- `apps/mobile/src/lib/bffClient.ts`, `apps/mobile/src/components/home/PostAdWizard.tsx` — Phase 4.
- `docs/plans/posting-speed-and-progress.md` (this plan, copied in per CLAUDE.md).

## Verification

1. `pnpm --filter web tsc --noEmit`, targeted eslint on every touched file (no `--fix`).
2. Manual run against a local/dev BFF: post an ad with 5-6 photos and a video on a throttled
   connection (Chrome DevTools "Slow 4G") — confirm photos upload visibly in parallel (network
   waterfall shows overlapping requests, not a strict train of one-at-a-time), the button text
   updates through photo-count → video-percentage → "Creating listing…", and total wall-clock time
   drops versus the pre-change sequential behavior on the same throttle profile.
3. Force a mid-batch photo failure (e.g. temporarily rename a file mid-upload, or a deliberately
   invalid file in one slot) — confirm the same user-facing abort/error behavior as today, modulo
   the documented "a couple of in-flight uploads from the same wave may still land" caveat.
4. Force the video 503 path: temporarily lower `MAX_CONCURRENT_VIDEO_UPLOADS` to 1 locally and
   upload 2 videos at once — confirm the second now retries and succeeds instead of hard-failing.
5. Deploy `web` only for Phases 1-3 (no BFF changes needed — the 503-retry fix is client-side).
   Post a real ad through production after deploy, including at least one video, and confirm the
   listing publishes correctly with its photos/video intact.
6. Phase 4: same manual checks on a real device (iOS + Android) before considering mobile done.
