# Fix the broken "Bhavano" watermark, make it big and centered, and add it to videos

**Status: implemented** (see "Implementation notes" at the end).

## Context

Every listing photo already gets a watermark (`buildWatermarkSvg` in
`apps/bff/src/photo-processing/photo-processing.service.ts`): a small logo plus the word "Bhavano"
in the bottom-right corner. On production the word renders as a row of empty boxes. Cause,
confirmed on a live photo and on the running container: the word is SVG `<text>`, which sharp draws
with system fonts, and the BFF's Alpine image has none (`fc-list` is empty, `/usr/share/fonts` is
empty). The logo icon is fine because it's an embedded PNG.

Videos have no watermark at all: `transcodeAndExtractPoster` in
`apps/bff/src/video-processing/ffmpeg.ts` only scales and re-encodes, and the poster frame is
un-marked too.

Decisions from the user: a **large, centered "Bhavano" text** at about **40% opacity**, with the
**small logo kept in the bottom-right**, on photos, videos and video posters. **Existing photos are
redone; videos only from now on** (video originals are deleted after 7 days by an R2 lifecycle rule,
so old videos can't be re-made cleanly).

## Approach

### 1. Make the text not depend on fonts (the actual bug fix)

Turn the word "Bhavano" into a fixed **vector path** once, and embed it as a constant, the same way
`watermark-logo.ts` already embeds the logo PNG as base64. Nothing then needs fonts at runtime, on
the server or in ffmpeg, and it looks identical everywhere.

- One-off script (run once, output pasted into the repo; the tool is not a project dependency)
  using `opentype.js` and an open-licence bold serif (e.g. Playfair Display, OFL, from
  `@fontsource/playfair-display`) to convert "Bhavano" into an SVG path string plus its bounding
  box. Not Georgia: its outlines are Microsoft-licensed.
- New file `apps/bff/src/photo-processing/watermark-wordmark.ts` holding that path and its
  dimensions. A comment records how it was generated and the font licence.

### 2. One shared mark builder, used by photos and video

Rewrite `buildWatermarkSvg(width, height)` (keep its name and file so the photo worker doesn't
change), and move it into its own module `watermark.ts` so the video code can import it too:

- **Centered text:** scale the path to about **46% of the image width**, center it on both axes
  using the stored bounding box. Drawn as a wider dark stroke path underneath and a white fill path
  on top, inside a `<g opacity="0.4">`, so it stays legible on both light and dark photos.
- **Logo:** keep the existing bottom-right logo (`0.11 × width`, same margin, same opacity). Remove
  the text that used to sit beside it.
- Because the size is a percentage of the width, the mark reads the same on the 480px preview, the
  1600px full photo, and a 1280px video.

Photo pipeline change is only that `buildWatermarkSvg` now returns the new SVG; the sharp
`composite` call in `processPending` is unchanged.

### 3. Videos and posters (`apps/bff/src/video-processing/`)

- `probeVideo` (ffmpeg.ts) also returns the displayed `width` and `height`, swapping them when the
  stream carries a 90°/270° rotation tag (phones record portrait video that way).
- Work out the output size exactly as the existing `scale=...force_original_aspect_ratio=decrease`
  filter will (fit within `VIDEO_TRANSCODE.maxLongEdge`, even numbers). In `processOne`
  (video-processing.service.ts), render `buildWatermarkSvg(outW, outH)` to a transparent PNG with
  sharp and write it to the same tmp dir (cleaned up in the existing `finally`).
- `transcodeAndExtractPoster` gains a `-i watermark.png` second input and switches from `-vf` to a
  `-filter_complex`: scale, then `overlay=0:0`, then split into the video output and the poster
  output. The poster therefore comes out already watermarked, and the existing `sharp` resize of
  the poster keeps the mark proportional.
- Overlaying a full-frame transparent PNG on a 1280px video is cheap next to the x264 encode, so
  the `t4g.medium` CPU-credit budget in `docs/plans/listing-video-uploads.md` is not materially
  affected. Existing timeouts stay.

### 4. Redo existing photos

New script `apps/bff/prisma/requeuePhotoVariants.ts`, following the existing
`prisma/backfill*.ts` scripts: set every `PhotoVariantJob` back to `pending` (attempts 0, error
null) so the existing worker rebuilds each variant from the stored original, and bump
`ListingPhoto.updatedAt` so the public `?t=` URL changes and browsers and Next's image cache fetch
the new bytes (the job already purges the Cloudflare URL). Supports a `--dry-run` count and a
`--limit` so it can run on a handful first. The worker handles about 5 jobs per 3 seconds, so the
whole set drains on its own without extra load. Run by hand on the host after deploy.

## Not doing

- No fonts installed in the Docker image (unneeded once the text is a path).
- No re-encode of videos already uploaded (needs a second lossy pass from the 720p copy).
- No change to who can see originals, storage keys, or the upload flow.

## Critical files

- `apps/bff/src/photo-processing/photo-processing.service.ts` (mark moved out, otherwise unchanged)
- `apps/bff/src/photo-processing/watermark.ts` (new), `watermark-wordmark.ts` (new),
  `watermark-logo.ts` (reused)
- `apps/bff/src/video-processing/ffmpeg.ts`, `video-processing.service.ts`
- `apps/bff/prisma/requeuePhotoVariants.ts` (new)
- `docs/plans/watermark-centered-wordmark.md` (this plan, copied in per CLAUDE.md, plus a note in
  `docs/plans/listing-video-uploads.md` that videos are now watermarked)

## Verification

1. Unit tests: `buildWatermarkSvg` contains no `<text>` element, contains the path, and the text
   bounding box is centered within a pixel for several sizes; a size helper test for the video
   output dimensions including a rotated portrait input. Existing
   `photo-processing.service.spec.ts` still passes.
2. Render the new mark onto a sample photo locally with sharp at 480 and 1600 wide and **look at
   the result** (readable, centered, logo bottom-right, not too heavy).
3. Video: on the production host, run ffmpeg from the current `bhavano-bff` image in a throwaway
   container (no effect on the running service) against generated landscape and rotated-portrait
   test clips; extract a frame and the poster and look at them. Confirm duration and playback
   still fine with ffprobe.
4. `nest build`, BFF tests, targeted eslint (no `--fix`).
5. Deploy `bff` only. Upload a new photo and a new short video through the real flow and view the
   photo, the video and its poster on the site.
6. Run the requeue script with `--dry-run`, then `--limit 5`, view those photos live, then the
   rest. Spot-check that old listings show the centered text instead of boxes.

## Implementation notes

- The wordmark is Playfair Display Bold (OFL) converted to a path at font size 1000 with
  `opentype.js`; the path and its bounding box live in `watermark-wordmark.ts`.
- **Verified in a throwaway container from the production `bhavano-bff` image** (real ffmpeg 8.1.2,
  no running service touched): landscape 1920x1080, a rotated portrait clip (display-matrix
  rotation) and a small 640x360 clip. The probed size, the size `transcodeOutputSize` predicted and
  the actual output size matched in all three (1280x720, 720x1280, 1280x720). Audio and duration
  were preserved. Video frames and the poster were viewed and carry the centered text and the corner
  logo. Note the transcode filter *upscales* small videos to fit the 1280 box, which the size helper
  mirrors.
- The requeue script requires `--before=<ISO time>` (the deploy time) so a re-run, or a `--limit`
  sample followed by the full run, never redoes the same photo twice. npm script:
  `backfill:photo-watermark`.
- Local `nest build` initially failed only because the locally generated Prisma client was stale
  (another change added `allowLivePublishWithPendingPayment`); regenerating it fixed that. Unrelated
  to this work.
- **Deployed 2026-09-25 14:03 UTC** (`bff` only). Verified live: rebuilt photos on the CDN show the
  centered wordmark and corner logo. The photo backfill was run with
  `--before=2026-09-25T14:03:00Z` (3,034 jobs / 1,518 photos); the worker drains it at roughly 20
  jobs per minute, so it takes a couple of hours. The video path was verified with real ffmpeg in a
  throwaway container from the production image but **not yet with a real upload through the app**:
  the first new video uploaded after this deploy is the real end-to-end test.
- **Deploy incident (disk full).** The production host's root disk is only 29 GB and was 96% full
  (12 GB Docker build cache that can't be pruned because it's shared with the running images, plus
  4 GB of rotated bff logs and a 1.1 GB Loki container log). The first two `docker compose up
  --build bff` attempts failed at the image-unpack step with "no space left on device". Freed space
  by emptying Loki's container log and deleting bff log files older than 14 days (both approved).
  Separately, a guard I added that killed the compose process when free space got low did so
  *after* compose had stopped the old `bff` container and *before* it started the new one, leaving
  the API down for about 3.5 minutes until it was started by hand. Never kill `docker compose`
  mid-recreate. Structural fixes still to do: enlarge the disk, and cap the `bff_logs` volume and
  container-log sizes.
