-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "uniqueViewerCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: distinct-viewerKey count per listing from existing ListingView rows. Listings with
-- no views keep the column default of 0.
UPDATE "Listing" l
SET "uniqueViewerCount" = sub.cnt
FROM (
  SELECT "listingId", COUNT(DISTINCT "viewerKey") AS cnt
  FROM "ListingView"
  GROUP BY "listingId"
) sub
WHERE sub."listingId" = l.id;
