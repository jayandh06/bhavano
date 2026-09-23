-- CreateEnum
CREATE TYPE "ListingPublishState" AS ENUM ('live', 'pending_checkout');

-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'listing_publish';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "publishState" "ListingPublishState" NOT NULL DEFAULT 'live',
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- Backfill publishedAt for existing live listings
UPDATE "Listing" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;

-- CreateTable
CREATE TABLE "PlatformFeeSetting" (
    "id" TEXT NOT NULL,
    "propertyListingFee" INTEGER NOT NULL DEFAULT 0,
    "coworkingPgStorageListingFee" INTEGER NOT NULL DEFAULT 0,
    "furnitureInteriorsListingFee" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeeSetting_pkey" PRIMARY KEY ("id")
);
