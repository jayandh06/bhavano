# Posting an ad is one transaction (a listing never exists without its photos)

## Status: built 2026-11-21

**What happened:** a listing posted at 11:36:56.728 UTC on 2026-11-21 went live with 0 photos and no
"created" edit-log entry. The BFF container was replaced 0.46 s later (11:36:57.187 UTC) by a deploy.
`ListingsService.create` inserted the listing as `live` and then added the user's seller type, the
photos, the photo-processing jobs and any videos as separate statements, so a restart between the
insert and the photo insert left a live ad with no photos. Minimum photos (3) is checked up front, so
this path bypassed it.

**Fix:** `insertListingWithMedia` (`listings.service.ts`) runs the listing insert, the optional
seller-type save, `ListingPhoto`, `PhotoVariantJob` and `ListingVideo` inserts in one
`prisma.$transaction` (15 s timeout). Video entitlement is resolved before it (a read). Post-live side
effects (alerts, conversion uploads, edit log) still run after the commit. Tests:
`listings.service.spec.ts` ("insertListingWithMedia").

**Not changed / still open**
- Four older live listings with no photos exist (Sep 26, Sep 15, Jul 15, Jul 14). Cause unknown; the
  fix only prevents new ones.
- Whether the BFF container finishes in-flight requests when it is replaced (stop grace period) was
  not checked.
- Admin-assisted and bulk-import creates use the same path and are covered.
