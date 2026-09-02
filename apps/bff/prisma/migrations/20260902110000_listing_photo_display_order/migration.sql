-- AlterTable: add nullable, backfill from the existing photoNo (unchanged order for every
-- existing photo), then tighten to NOT NULL.
ALTER TABLE "ListingPhoto" ADD COLUMN "displayOrder" INTEGER;

UPDATE "ListingPhoto" SET "displayOrder" = "photoNo";

ALTER TABLE "ListingPhoto" ALTER COLUMN "displayOrder" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ListingPhoto_listingId_displayOrder_idx" ON "ListingPhoto"("listingId", "displayOrder");
