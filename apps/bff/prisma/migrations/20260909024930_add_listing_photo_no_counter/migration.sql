-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "photoNoCounter" INTEGER NOT NULL DEFAULT 0;

-- Backfill: without this, the first post-launch photo add on any pre-existing listing computes
-- photoNo = 1 and silently overwrites photo #1's R2 objects (see the column's own doc comment in
-- schema.prisma for why photoNo can never be reissued).
UPDATE "Listing" l SET "photoNoCounter" = COALESCE(
  (SELECT MAX(lp."photoNo") FROM "ListingPhoto" lp WHERE lp."listingId" = l.id), 0
);
