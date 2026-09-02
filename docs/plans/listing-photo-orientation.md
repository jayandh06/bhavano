# Fixing sideways/upside-down listing photos

## What was actually wrong

Not a data problem — a missing line. `PhotoProcessingService` (the background worker that turns
an uploaded original into the preview/full WebP variants everyone actually sees) resized and
re-encoded every photo without ever calling `sharp(...).rotate()`:

```ts
const { data: resizedRaw, info } = await sharp(original)
  .resize(width, null, { withoutEnlargement: true })
  .toBuffer({ resolveWithObject: true });
```

Phone cameras almost always record orientation as an EXIF tag rather than physically rotating the
pixel data. Sharp's WebP encoder strips that tag by default — and without `.rotate()` first to
bake the tag's rotation into the actual pixels before that happens, the output keeps whatever
orientation the sensor originally captured, EXIF tag and all context gone. A portrait phone photo
comes out sideways.

This codebase already had the correct pattern elsewhere — `apps/bff/src/support/support-attachments.ts`
calls `.rotate() // bake in EXIF orientation before that metadata is discarded` on support-ticket
attachments. It just was never applied to the listing-photo pipeline.

## The fix, in two parts

### 1. Root cause — every future upload

`PhotoProcessingService.processPending()` now calls `.rotate()` (auto EXIF-orient) before
resizing. This alone fixes every photo uploaded from here on, with no admin action ever needed.

### 2. Already-published photos — admin manual rotate

The root-cause fix doesn't retroactively touch already-generated WebP variants — their pixels are
already baked wrong. Rather than an automatic bulk reprocess of every existing listing (considered
and explicitly turned down — a human should confirm before a live listing's images change), admins
get a manual "rotate 90°" button per photo on the existing listing moderation page
(`apps/admin/.../listings/[id]/page.tsx`), for the case where EXIF is missing/wrong or the photo
predates this fix.

**Schema**: `ListingPhoto.rotation` (`Int`, default `0`) — the admin's manual correction in degrees
clockwise, on top of whatever automatic EXIF orientation already produces. Persisted per-photo, not
baked into a one-off file edit, so it survives every future reprocess.

**Reprocessing**: `AdminService.rotatePhoto(listingId, photoNo)` increments `rotation` by 90 (mod
360) and resets that photo's existing `PhotoVariantJob` rows back to `pending` — reusing the
existing rows rather than creating new ones, since they already know the original's file extension
(`PhotoVariantJob.ext`), which `ListingPhoto` itself never stores. `PhotoProcessingService` picks
the reset jobs up on its next poll (every 3s) and regenerates both variants from the stored
original, applying `.rotate()` for EXIF *and* the admin's `.rotate(rotation)` on top.

**Endpoint**: `POST /admin/listings/:id/photos/:photoNo/rotate` → `{ rotation: number }`.

**Cache-busting**: variant storage keys never change (`apps/bff/src/uploads/photo-keys.ts`) — only
their bytes do, once rotated. `ListingDetailDto` gained `photoNos`/`photoRotations` (parallel
arrays to `photosFull`) so the admin UI can render each image as `${url}?r=${rotation}` — a browser
or CDN that already cached the pre-rotation bytes at that exact URL won't keep serving them, since
the query string changes the moment the rotation value does.

**UI**: `RotatablePhotoGrid` (admin, client component) — a small rotate button overlaid on each
photo thumbnail. Since the reprocess is async, clicking it shows a brief "rotating" state and waits
~4s (a bit of margin over the 3s poll interval) before refreshing, rather than refreshing
immediately and having the admin see the same still-wrong image and assume the click did nothing.

## A follow-up bug this surfaced: rotate clicks racing the background worker

Reported after this shipped: rotating sometimes appeared to skip one step entirely, and the
*next* click after that would jump 180° instead of 90°.

Root cause: `PhotoProcessingService.processPending()` does a real network round trip (download the
original from R2, re-encode, upload the new variant) between claiming a job (`status: 'processing'`)
and marking it done. If an admin's next rotate click landed on the same photo while that was still
in flight, `AdminService.rotatePhoto()` would correctly reset the job row back to `pending` for the
new rotation — but the *stale* run, finishing later, wrote `status: 'done'` unconditionally,
clobbering that reset. The row was left at `'done'` holding content from the *older* rotation,
and — no longer `pending` — the poller never looked at it again. That click's effect was silently
lost. The next click then computed its target angle correctly (`ListingPhoto.rotation` itself was
never racy, only the job-table side), but visually that read as a 180° jump from wherever the
stuck state had left the image.

Fixed by guarding both the success and failure completion writes with `status: 'processing'` in
the `WHERE` clause (`updateMany`, checking `count`), so a run only ever finalizes a job it still
owns — one a newer click has already reset out from under it is left alone, exactly as it should
be. Covered by `photo-processing.service.spec.ts`.

## A second follow-up: the *real* "one direction stays unrotated"

The race-condition fix above was real, but it turned out not to be what was actually being
observed — reported as still happening afterward, with a telling detail: the skipped direction
was consistently the photo's *correct* orientation.

Root cause: the admin UI cache-busted each photo's image URL with `?r=<rotation>`. `rotation`
cycles — 0 → 90 → 180 → 270 → 0 → … — and every photo starts at `rotation: 0`. That means `?r=0`
had *already been requested once*, the very first time the admin ever opened this listing's
moderation page, before clicking rotate at all. Once the rotate cycle wrapped back around to 0,
the request was for a URL a browser (or `CDN_BASE_URL`'s Cloudflare edge, which caches static file
types like `.webp` by URL+query string by default, independent of origin `Cache-Control`) had
already cached — so it served the original, pre-rotation content instead of hitting R2 for the
freshly reprocessed file. `rotation: 0` is also, for the common case this feature exists to fix
(EXIF was present but ignored — see the root-cause fix at the top of this doc), usually the
*correct* final state, needing no manual correction once reprocessed with the fix in place. Hence
the "ironic" pattern: the one value guaranteed to collide with a stale cache entry was also the
one most photos actually needed to land on.

Fixed by no longer using `rotation` as the cache-busting value at all. `ListingPhoto` gained
`updatedAt` (bumped on every write, including one that lands back on `rotation: 0`), exposed as
`ListingDetailDto.photoUpdatedAts` and used as `?t=<updatedAt>` instead — a value that, unlike
`rotation`, is never reused, so it can never collide with a request cached from before the photo
was ever rotated.

## A third follow-up: the admin panel updated, the public listing didn't

Fixing the cache-key collision above made the admin panel show a rotated photo correctly right
away — but visiting the actual public listing page still showed the old orientation.

The `?t=<updatedAt>` fix only busts the cache for whoever's browser makes that exact request — the
admin's own view. The public site (browse cards, the listing detail gallery) requests the bare
variant URL, no query string at all, same as it always has. Confirmed directly against a live
photo's response headers:

```
Server: cloudflare
Cache-Control: max-age=14400
cf-cache-status: MISS
```

`CDN_BASE_URL` (`cdn.bhavano.com`) is a Cloudflare-fronted R2 bucket, and Cloudflare applies its
own default 4-hour edge cache to static file types like `.webp`, independent of anything
`R2StorageService.putObject` sets (it sets no `Cache-Control` at all). Before the rotate feature,
this was never a problem — every variant key was written once and never touched again, so nothing
was ever stale at a URL someone had already fetched. A rotate is the first thing that rewrites an
*already-cached* key, and the bare public URL keeps serving Cloudflare's cached pre-rotation copy
for up to that 4-hour TTL, regardless of what R2 actually holds now.

Fixed with an explicit purge: `CdnPurgeService` (`apps/bff/src/storage/cdn-purge.service.ts`)
calls Cloudflare's `purge_cache` API for a photo's exact variant URL right after
`PhotoProcessingService` finishes writing it — same best-effort, fail-soft convention as
`WhatsappProvider`/`EmailProvider` (unconfigured logs and skips, a failed call logs and returns
`false`, never blocks or fails the reprocess itself — the file in R2 is already correct either
way, an unpurged cache only means the public URL takes longer to catch up, not that anything is
actually wrong with the data). Needs `CLOUDFLARE_API_TOKEN` (Zone → Cache Purge permission) and
`CLOUDFLARE_ZONE_ID` in `.env` — both optional; without them, rotating still fully works, the
public URL just waits out Cloudflare's TTL on its own, as it did before this existed.

## A fourth follow-up: a third cache layer, found on the live listing page

Even with the Cloudflare purge live and confirmed working (verified directly: the purged URL's
next request showed `cf-cache-status: MISS` and a fresh `Last-Modified` matching the rotation), a
real listing page (`/bengaluru/.../2bhk-for-rent-<id>`) still showed the old orientation.

The page's `<Image>` doesn't request the CDN URL directly — it goes through Next.js's own image
optimization proxy, confirmed from the rendered HTML:

```
/_next/image?url=https%3A%2F%2Fcdn.bhavano.com%2Fphotos%2F<id>_1_full.webp&w=1200&q=75
```

That proxy has its *own* cache, entirely independent of Cloudflare's — the response carries
`Cache-Control: public, max-age=14400, must-revalidate` (Next's default `minimumCacheTTL`, unset
in `next.config.ts`) and `X-Nextjs-Cache`. It's keyed by the exact source URL + width + quality,
and doesn't know or care that the upstream content changed — it just keeps serving whatever it
already cached for that exact key until its own TTL expires, regardless of what Cloudflare or R2
now hold. Since the bare `photosFull`/`photos` URLs never changed before, once any of the several
responsive-image widths Next generates for a real device had been cached even once (near-certain
for an already-published, previously-viewed listing), it would keep serving that stale copy for
up to 4 hours after a rotate — a purge to Cloudflare never reaches this layer at all.

Fixed at the source rather than by chasing a third purge target: `photosFull`/`photos`
(`ListingDetailDto`/`ListingCardDto`) now use `publicVariantUrl()`
(`apps/bff/src/uploads/photo-keys.ts`) instead of the bare `variantUrl()` — the same URL plus
`?t=<ListingPhoto.updatedAt>`, the identical cache-busting scheme already used for the admin
panel. An unrotated photo's URL never changes, so this costs nothing for the overwhelming majority
of photos; a rotate changes `updatedAt`, which changes this URL, which every cache in the chain
(browser, Cloudflare, Next's optimizer) correctly treats as a resource it has never seen — no
purge needed for any of them, since there's nothing stale to evict when the URL itself is new.
The Cloudflare purge from the previous section is kept regardless, as: `variantUrl()` (the bare,
un-busted form) is still the real object identity and what `CdnPurgeService` targets, and cheap
insurance doesn't hurt.

The same query string is also fine everywhere else `photosFull` is read — JSON-LD `image`,
Open Graph, and Twitter Card tags all accept an absolute URL with a query string, and a crawler
picking up the *current* correctly-oriented image over a stale one is a genuine improvement, not
just a non-issue.

## A design flaw, not a bug: saving on every click

Flagged directly: needing several 90° clicks to find the right orientation meant several full
reprocess cycles — each rotate click saved immediately and triggered its own R2
download/resize/upload/purge round trip, even when the very next click immediately superseded it.
Three clicks to get from a sideways photo to the right orientation meant three multi-second round
trips for what only ever needed to produce one final result.

Fixed by separating preview from save. `RotatablePhotoGrid`'s rotate button now only cycles a
local, unsaved `previewTurns` state (0-3) and applies it as a CSS `transform: rotate()` on the
thumbnail — no network call, instant. A "Save" button appears once there's an unsaved preview, and
only *that* calls the server, once, with however many turns the admin landed on
(`rotatePhotoAction(listingId, photoNo, turns)`). `AdminService.rotatePhoto` takes the full `turns`
count (1-3, validated by `RotatePhotoDto`) rather than always advancing by exactly one, so the
whole decision becomes one `rotation = (current + 90 × turns) % 360` write and one reprocess,
regardless of how many preview clicks it took to get there. A "✕" button next to Save discards the
preview without saving.

One visual caveat in the preview itself: a 90°/270° preview swaps the image's effective aspect
ratio, which a fixed-height `object-fit: cover` thumbnail doesn't accommodate — the grid switches
to `object-fit: contain` (letterboxed) only while previewing one of those two states, so the admin
can still see the whole frame to judge the orientation before committing.

## What was deliberately not built

- **No automatic bulk reprocess of existing listings.** Considered, turned down in favor of manual
  per-photo review — the root-cause fix means this gap doesn't grow going forward, and a human
  looking at each already-published listing's photos before they change is preferred to a
  fire-and-forget batch job touching live listings unsupervised.
- **No free-rotate/crop editor.** In practice this class of bug is always a clean 90/180/270 flip —
  a stepped button matches that exactly, at a fraction of the UI/reprocessing complexity a full
  editor would need.
