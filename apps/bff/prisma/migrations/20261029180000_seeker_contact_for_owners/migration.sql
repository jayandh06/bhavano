-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactShareChoice" TEXT NOT NULL DEFAULT 'unset';

-- AlterTable
ALTER TABLE "ListingInterest" ADD COLUMN     "contactViewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeadContactReveal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "creditBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadContactReveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeekerContactSetting" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "consentMode" TEXT NOT NULL DEFAULT 'notice',
    "freeLeadRevealsPerOwner" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeekerContactSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadContactReveal_ownerId_createdAt_idx" ON "LeadContactReveal"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadContactReveal_listingId_seekerId_key" ON "LeadContactReveal"("listingId", "seekerId");

-- AddForeignKey
ALTER TABLE "LeadContactReveal" ADD CONSTRAINT "LeadContactReveal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContactReveal" ADD CONSTRAINT "LeadContactReveal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContactReveal" ADD CONSTRAINT "LeadContactReveal_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContactReveal" ADD CONSTRAINT "LeadContactReveal_creditBatchId_fkey" FOREIGN KEY ("creditBatchId") REFERENCES "ContactRevealCreditBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
