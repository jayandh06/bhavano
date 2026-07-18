-- CreateEnum
CREATE TYPE "PhotoVariantType" AS ENUM ('preview', 'full');

-- CreateEnum
CREATE TYPE "PhotoJobStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- DropForeignKey
ALTER TABLE "PhotoHash" DROP CONSTRAINT "PhotoHash_listingId_fkey";

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "photos";

-- DropTable
DROP TABLE "PhotoHash";

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "photoNo" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoVariantJob" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "photoNo" INTEGER NOT NULL,
    "ext" TEXT NOT NULL,
    "variant" "PhotoVariantType" NOT NULL,
    "status" "PhotoJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoVariantJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingPhoto_hash_idx" ON "ListingPhoto"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "ListingPhoto_listingId_photoNo_key" ON "ListingPhoto"("listingId", "photoNo");

-- CreateIndex
CREATE INDEX "PhotoVariantJob_status_createdAt_idx" ON "PhotoVariantJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

