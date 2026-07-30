-- CreateTable
CREATE TABLE "ListingRenewal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "previousExpiresAt" TIMESTAMP(3) NOT NULL,
    "newExpiresAt" TIMESTAMP(3) NOT NULL,
    "renewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingRenewal_listingId_idx" ON "ListingRenewal"("listingId");

-- AddForeignKey
ALTER TABLE "ListingRenewal" ADD CONSTRAINT "ListingRenewal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
