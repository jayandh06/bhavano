# Google Ads: "Add images to your ads" and "Add dynamic images"

## Status (2026-09-29)

- Decided: **AI-generated images**; **dismiss dynamic images**.
- Wave 1 images (Generic and Sell) have been generated and cropped into
  `marketing/google-ads/images/`, pending the owner's review.
- **Wave 1 applied 2026-09-29.** 12 image assets were uploaded and 24 links created: 6 images in
  each of Metro and Other-Metro Generic Post Ad Intent and Sell. All links are enabled and in
  policy review (PENDING). Check approval on 2026-09-30.
  - Rollback: `python ads_image_assets.py --wave 1 --remove`.
  - Measurement window: 2026-09-29 to ~10-13, compared against Rent Out and Lease, which have
    no images yet.
- Wave 2 (Rent Out and Lease) comes after the second-ad test ends (~2026-10-12).
- Business name and logo are already linked on all 8 Search campaigns. The logo is the one
  Google suggested ("Suggested logo #2"), so no step 3 is needed unless it's the wrong logo.

Two optimization-score recommendations on the Search account (customer 4214066478). Context:
[`google-ads-performance-analysis-2026-09.md`](google-ads-performance-analysis-2026-09.md). There
are 8 Search campaigns (Sell / Rent Out / Lease / Generic × Metro / Other-Metro), all with final
URL `https://www.bhavano.com`, audience = property **owners**. The recurring problem in that doc is
attracting **seekers** instead of owners.

## Decision summary

| Recommendation | Verdict |
|---|---|
| **Add images to your ads** (manual image assets) | **Do it**: owner-intent images we choose and control |
| **Add dynamic images** (Google picks images from our pages) | **Dismiss for now**, and revisit only after the conditions below |

Optimization score is Google's checklist, not a ranking factor. Dismissing a recommendation, with
a reason, also removes it from the score, so dismissing dynamic images costs nothing but a click.

## Why not dynamic images (yet)

Dynamic images crawl the final URL's pages and put images from them next to the ad. Our final URL
is the home page, whose images are almost all **owners' listing photos**. That causes four problems:

1. **It attracts the wrong audience.** A photo of a flat next to the ad reads as "flat for sale or
   rent", which is exactly the seeker click the ad copy work is trying to filter out. Specific-asset
   ad groups already have 54–63% "did nothing" visits.
2. **We have no licence to use them.** `/terms` only has the poster confirm the photos are
   accurate and theirs to post; it grants Bhavano no right to use listing content in its own
   advertising. Showing one owner's home in a paid ad without that is a legal and trust risk.
3. **Quality and policy.** Listing photos include other portals' watermarks, phone numbers
   written on images, people's faces, blurry shots and random cities. Any of these can get the
   asset disapproved, or simply look bad.
4. **Little control.** We can remove individual images after they appear, but not choose which
   ones Google picks.

**Revisit when:** manual images have run ~4 weeks and helped CTR or conversions per click, **and**
`/terms` adds a licence for Bhavano to use listing content in marketing, **and** either the ads
use per-intent landing pages whose images are owner-intent, or the home page's paid view
(`AdLandingCard`) carries its own suitable images. Then trial it on one campaign as an experiment.

## Manual image assets: what to build

### Google's requirements (Search image assets)

- **Aspect ratios:**
  - landscape 1.91:1: 1200×628 recommended, 600×314 minimum;
  - square 1:1: 1200×1200 recommended, 300×300 minimum;
  - portrait 4:5 (960×1200) is optional.
- **File:** JPG or PNG, ≤ 5 MB. Up to 20 images per campaign; aim for **4–6 per campaign**, each
  in both ratios.
- **Content rules** (the usual reasons for disapproval):
  - no overlaid text, logos or buttons;
  - no collages or borders;
  - not blurry, and not mostly white space;
  - the subject centred so either crop works.

  This rules out reusing the Play feature graphic, which has a text overlay.
- **Business name and logo** are separate account-level assets. Check they're set: name
  "Bhavano"; logo from `apps/mobile/assets/icon.png` (1024×1024 is fine, the minimum is 128×128).

### Image concepts, by campaign intent

Every image must say **"owner listing their property"**, never "home to buy or rent". Indian urban
settings, bright, natural, no text.

| Campaign | Concepts (2–3 each) |
|---|---|
| Generic Post Ad | Owner on a sofa posting on a phone (screen not legible); couple photographing their living room with a phone; hand holding a phone at a flat's window |
| Sell | Owner family standing outside their independent house; handshake and keys over paperwork at a dining table; owner photographing an apartment balcony |
| Rent Out | Landlord handing keys to a tenant at a flat door; owner photographing a furnished bedroom; empty clean flat ready to let (no people) |
| Lease | Owner at the door of an empty shop; office floor ready to lease, owner on a phone; key handover at a commercial unit |

A **PG** image (owner making up a bed in a clean shared room) can be added to Rent Out's PG ad
group at ad-group level if that group keeps spending.

### Where images come from (pick one; decision needed)

| Source | Pros | Cons |
|---|---|---|
| **AI-generated** (Google Ads Asset Studio, or generated here) | Fast, free, exact concepts, Indian settings | Must check hands, faces and artefacts; Google labels AI images in some placements |
| **Stock** (Pexels or Unsplash, commercial use) | Real photos | Generic, the same images appear on competitors' ads; model-release check for people |
| **Own photos** (team or friendly owners, signed consent) | Most authentic, reusable for social and Play screenshots | Slowest |

Recommended: start with AI-generated or stock to get live quickly, then replace the best
performers with own photos.

### Wave 1 images (generated 2026-09-29)

The generated source images are in `marketing/google-ads/images/source/`. Running
`python marketing/google-ads/images/make_ad_images.py` writes to `out/`: a 1200×628 landscape
and a 720×720 square per image (never upscaled). Per-image crop focus is set in the script.

| Image | Campaign |
|---|---|
| `generic-owner-posting-phone` | Generic Post Ad |
| `generic-couple-photographing-room` | Generic Post Ad |
| `generic-phone-at-window` | Generic Post Ad |
| `sell-family-outside-house` | Sell |
| `sell-handshake-keys-documents` | Sell (also fits Rent Out and Lease in Wave 2) |
| `sell-owner-photographing-balcony` | Sell |

## Implementation steps

1. **Produce the images.**
   - Store the source images and a crop script in `marketing/google-ads/images/`. It writes
     `<concept>-square.jpg` (1200×1200) and `<concept>-landscape.jpg` (1200×628) with a smart
     centre crop, JPG quality ~85, and checks file size.
   - Review every image by eye against the content rules before upload.
2. **Upload with the script: `ads_image_assets.py --wave N`**, following the pattern of
   `ads_pmax_assets.py`.
   - Run `--dry-run`, then `--validate`, then without a flag.
   - Asset creation and linking go out as one `GoogleAdsService.mutate` using temporary asset
     ids, so validation covers the whole change and a real run is all-or-nothing.
   - Create an `ImageAsset` per file, named `bhavano-<concept>-<ratio>` so re-runs reuse it
     instead of duplicating it.
   - Link each image to its campaigns as a `CampaignAsset` with `field_type = AD_IMAGE`, the
     same concepts in Metro and Other-Metro for each intent.
   - Read back and print the link status and policy review state.
   - `--remove` unlinks everything the script added (rollback). Don't delete the assets
     themselves, so they can be reused.
3. **Check the business name and logo** assets at account level; add them if missing, in the same
   script or by hand in the UI.
4. **Dismiss "Add dynamic images"** in Recommendations, reason: "Not relevant for my business".
   Also make sure "Dynamic images" is off at account level (Assets → Automatically created
   assets), so it isn't auto-applied later.
5. **Next day:** check policy status. Replace any disapproved image.

## How to judge it (2 weeks, then 4)

Images only show in some auctions (mostly mobile, top positions), so compare **per campaign,
before vs after**. In the Assets report, look at impressions with an image.

- CTR and **conversions per click**. Higher CTR with lower conversion per click means the images
  attract seekers, so swap the concepts.
- The "did nothing" share of paid home sessions (40% baseline; see the analysis doc), and **cost
  per poster** from our own DB (≈ ₹300 baseline).
- Remove images that never serve or clearly underperform; keep 4–6 good ones per campaign.

Don't overlap this with the second-ad test (Lease 3.1 and 3.2, Rent Out 2.4 Commercial; runs
until ~2026-10-12). Images link at campaign level, so roll out in two waves:

- **Wave 1 (now):** Generic Post Ad Intent and Sell, Metro and Other-Metro.
- **Wave 2 (after ~10-12, once the ad test is decided):** Rent Out and Lease.

This also gives Wave 1 a same-period comparison group.

## Open decisions for the owner

1. Image source: AI-generated, stock or own photos (recommendation: AI or stock first).
2. OK to dismiss dynamic images for now?
3. Longer term: add a marketing-use licence for listing content to `/terms`, which is needed
   before dynamic images or any "real listings" creative.
