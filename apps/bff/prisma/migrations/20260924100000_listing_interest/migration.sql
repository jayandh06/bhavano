-- AlterTable
-- Identified listing interest (Option B soft gate) — see docs/plans/login-gated-listing-interest-owner-notify.md

CREATE TABLE "ListingInterest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "ListingInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingInterest_listingId_userId_key" ON "ListingInterest"("listingId", "userId");
CREATE INDEX "ListingInterest_listingId_lastSeenAt_idx" ON "ListingInterest"("listingId", "lastSeenAt");
CREATE INDEX "ListingInterest_userId_createdAt_idx" ON "ListingInterest"("userId", "createdAt");

ALTER TABLE "ListingInterest" ADD CONSTRAINT "ListingInterest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInterest" ADD CONSTRAINT "ListingInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
