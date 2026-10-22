-- AlterEnum
ALTER TYPE "ListingPublishState" ADD VALUE 'scheduled';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "publishAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PostedConfirmationSetting" ADD COLUMN "holdAdLive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Listing_publishState_publishAt_idx" ON "Listing"("publishState", "publishAt");
