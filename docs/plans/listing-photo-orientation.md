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

## What was deliberately not built

- **No automatic bulk reprocess of existing listings.** Considered, turned down in favor of manual
  per-photo review — the root-cause fix means this gap doesn't grow going forward, and a human
  looking at each already-published listing's photos before they change is preferred to a
  fire-and-forget batch job touching live listings unsupervised.
- **No free-rotate/crop editor.** In practice this class of bug is always a clean 90/180/270 flip —
  a stepped button matches that exactly, at a fraction of the UI/reprocessing complexity a full
  editor would need.
