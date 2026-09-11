-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "claimContactId" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_claimContactId_key" ON "Listing"("claimContactId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_claimContactId_fkey" FOREIGN KEY ("claimContactId") REFERENCES "OutreachContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
