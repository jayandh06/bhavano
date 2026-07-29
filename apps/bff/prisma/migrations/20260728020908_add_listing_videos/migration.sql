-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "ListingVideo" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "videoNo" INTEGER NOT NULL,
    "storageId" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingVideo_storageId_key" ON "ListingVideo"("storageId");

-- CreateIndex
CREATE INDEX "ListingVideo_status_createdAt_idx" ON "ListingVideo"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ListingVideo_listingId_idx" ON "ListingVideo"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingVideo_listingId_videoNo_key" ON "ListingVideo"("listingId", "videoNo");

-- AddForeignKey
ALTER TABLE "ListingVideo" ADD CONSTRAINT "ListingVideo_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

