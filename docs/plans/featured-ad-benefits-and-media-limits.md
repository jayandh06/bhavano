# Featured ads: richer media limits, "add more" prompts, and further benefits

## Status: plan only (2026-10-20) — nothing built. Values marked **(owner decision)** need a call before building.

## Why

Featured is now offered *after* the ad is live ([`post-first-featured-upsell.md`](post-first-featured-upsell.md)).
The pitch today is a gold badge, priority placement and Instant Alerts. Media is the most visible
thing a buyer judges an ad on, and it is the one benefit a seller can *see* the moment they pay.
Videos already unlock on Featured; photos do not. This plan (1) raises photo/video limits for Featured
ads, (2) tells sellers about it where they post, and (3) adds a few more benefits worth paying for.

## What exists today

| Item | Normal | Featured / Agent Pro | Where |
|---|---|---|---|
| Photos | 3–6 (flat `MAX_PHOTOS = 6`, no tiers) | same | `packages/types/src/photoLimits.ts`; enforced in both wizards and `ListingsService.create/addPhoto` |
| Photo size | 4 MB each (`MAX_PHOTO_BYTES`) | same | multer in `apps/bff/src/uploads/photo-upload.config.ts` |
| Videos | 1 × 30 s | 3 × 120 s | `VIDEO_LIMITS`, `resolveVideoEntitlement` (boosted listing **or** Agent Pro) |
| Video size | 200 MB flat (`MAX_VIDEO_BYTES`) | same | `video-multer.config.ts` |
| Upsell copy | none for photos | videos: `canUpgradeByBoosting` message inside `VideoManager` on the success screen | `docs/plans/listing-video-uploads.md` |

Constraint to remember: multer limits are fixed before any user/listing is known, so a per-tier *byte*
cap cannot live there (same reasoning the video config already documents). The tier must be enforced
in the service after parsing, with multer set to the highest tier's ceiling.

## 1. Higher media limits for Featured

Proposed values **(owner decision)**:

| | Normal | Featured / Agent Pro |
|---|---|---|
| Photos (count) | 6 | **12** |
| Photo size | 4 MB | **8 MB** |
| Videos (count) | 1 | 3 → **5** |
| Video length | 30 s | 120 s → **180 s** |
| Video size | 200 MB | 200 MB (unchanged) |

Notes on the choices:
- Photos are the big win: sellers hit the 6-photo cap today, and nothing distinguishes Featured there.
- Video size stays at 200 MB. The app host has 3.8 GB RAM and a small disk that has filled during
  builds (see the deploy notes); video is transcoded/probed on that box, so raise count and length
  conservatively and watch disk (`assertDiskSpaceAvailable` refuses uploads below 2 GB free).
- Photo bytes: multer ceiling rises to 8 MB for everyone; the normal-tier 4 MB rule is enforced in
  the service. Resized `preview`/`full` variants are produced asynchronously, so the larger source
  costs R2 storage and a little worker time, not page weight.

Implementation:
1. Add `PHOTO_LIMITS = { default: {maxPhotos: 6, maxBytes: 4MB}, elevated: {maxPhotos: 12, maxBytes: 8MB} }`
   and `resolvePhotoEntitlement(user, listing)` beside `resolveVideoEntitlement` in `packages/types`
   (same inputs: active Agent Pro **or** `boostedUntil` in the future). Export `MAX_PHOTOS` /
   `MAX_PHOTO_BYTES` as the *default* tier so existing imports keep compiling; migrate call sites.
2. BFF: `ListingsService.addPhoto` and the upload path check the entitlement for *this listing*;
   `create()` uses the default tier (the listing is not boosted yet), as video does at wizard time.
   Return `photoEntitlement` on the owner's listing detail DTO next to `videoEntitlement`.
3. Web and mobile wizards: replace the hard-coded `MAX_PHOTOS` with the entitlement for the
   listing being edited; keep 6 in the create step.
4. **Never hide media when a boost lapses.** Same rule as video: read paths do not filter by
   entitlement; a lapsed boost only stops *new* uploads above the normal cap.
5. Tests: entitlement resolver (normal / boosted / Agent Pro / lapsed boost), `addPhoto` over the
   normal cap with and without a boost, and a lapsed boost keeping its 12 photos.

## 2. Telling sellers (rewrite the posting copy)

Three touchpoints. The rule: state the benefit where the seller is *thinking about media*, and make
the way to get it obvious. Never imply it is available for free.

**a) Post-details step, under the photo and video upload zones (new).** Today the hint reads
"JPG, PNG or WebP · up to 4 MB each · N more allowed". Add a quiet line beneath it:

> Want to show more? Featured ads can add up to **12 photos** (8 MB each) and **5 videos** up to
> **3 minutes**. You can upgrade right after you post.

Show it whenever the ad is not already elevated, and make it non-blocking (no modal). At the cap,
change it to: "You've added 6 photos. Featured ads can add up to 12."

**b) Confirmation screen, in the Featured card's benefit list.** Add a bullet: "More photos and
videos: up to 12 photos and 5 longer videos." The benefits list should become the fuller list from
[`preview-featured-vs-normal-comparison.md`](preview-featured-vs-normal-comparison.md): gold badge,
priority placement, Instant Alerts, more media, daily activity digest. Keep wording to "priority
placement", never a guaranteed position (8-slot cap, see `boost-offer-conversion-2026-09.md`).

**c) Right after a successful upgrade (new).** Replace the generic "Your ad is now Featured" banner
with a short prompt: "Your Featured ad can now have up to 12 photos and 5 videos. Add more to stand
out" with a primary **Add photos / videos** button that opens the media manager for this listing.
Also show it on My Listings for any boosted ad that is below its new caps.

Platform notes: web `PostAdWizard.tsx` details step and success step; mobile `PostAdWizard.tsx`
equivalents. On iOS the upgrade path is the App Store sheet; the copy is the same but must not quote
a Razorpay price.

## 3. Other benefits worth building (in order)

| # | Benefit | What the seller sees | Data / building blocks that already exist | Effort |
|---|---|---|---|---|
| 1 | **Performance report** | "Your Featured ad: N views, M enquiries, K contact reveals vs your last 7 days" | Views (de-duplicated), enquiries and the admin listing-performance screen (`admin-listing-performance-screen.md`); boost-effectiveness job | Small–medium |
| 2 | **One free re-bump** | "Move my ad to the top" once during the Featured period (e.g. day 7) | Boost rotation (`boost-rotation.service.ts`) | Small |
| 3 | **Push to matching buyers** | "Sent to N buyers looking for something like this" | Requirements feed (`requirements-feed-for-owners-agents.md`, `property-requirements-demand-side.md`); verify whether saved searches exist. Needs frequency caps | Medium |
| 4 | **Priority review / "Quick responder" badge** | Faster moderation; a trust badge on the card | Moderation flow; response-time data | Small–medium |
| 5 | **Share kit** | WhatsApp-ready poster + QR + tracked short link | Existing WhatsApp share panel | Small |
| 6 | **Area-page placement** | Featured ads surface on the area overview pages | `area-overview-pages.md` | Medium |

Not recommended: guaranteed top position, any perk that costs per use (SMS/WhatsApp) without being
priced in, or a long list of vague perks — three or four clear benefits convert better.

## Phasing

1. **Phase 1 — media and copy** (sections 1 and 2): entitlement helper, BFF enforcement, wizard
   changes, copy on details and confirmation, post-upgrade prompt. Web and mobile together; mobile
   reaches users via OTA (no native change, runtime 1.1.0).
2. **Phase 2 — proof**: performance report (#1) and re-bump (#2).
3. **Phase 3 — reach**: matching-buyer push (#3), then the rest as demand shows.

## Success measures

Compare before/after for ads that reach the confirmation screen: boost checkout started, boost paid,
revenue per posted ad, photos per Featured ad, and live-ad share. A global before/after, not an A/B
test (volume is too small). Also watch R2 storage growth and host disk for the video change.

## Risks

- **Disk/CPU on the app host** from longer or more videos — raise gradually, keep the 2 GB free-disk guard.
- **Perceived bait**: if the details-step line reads like a paywall on basics, it hurts posting. Keep
  3–6 photos and 1 video fully free, and word the line as an extra, not a restriction.
- **Cap drift**: the same numbers must be shared by `packages/types`, the BFF and both wizards; one
  source of truth (the new `PHOTO_LIMITS`) avoids the mismatches this repo has hit before.

## Related

[`post-first-featured-upsell.md`](post-first-featured-upsell.md),
[`listing-video-uploads.md`](listing-video-uploads.md),
[`featured-listings-visibility-improvements.md`](featured-listings-visibility-improvements.md),
[`product-pricing-tiers.md`](product-pricing-tiers.md),
[`boost-30-day-and-included-alerts.md`](boost-30-day-and-included-alerts.md).
