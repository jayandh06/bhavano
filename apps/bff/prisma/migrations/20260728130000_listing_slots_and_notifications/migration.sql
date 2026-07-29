-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'seller_slot_pack';

-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'sellerSlotPack';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sellerSlotPackUntil" TIMESTAMP(3),
ADD COLUMN "agentProUnits" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "agentProUnits" INTEGER;

-- CreateTable
CREATE TABLE "ListingNotificationLog" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProBoostCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "listingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProBoostCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingNotificationLog_listingId_kind_key" ON "ListingNotificationLog"("listingId", "kind");

-- CreateIndex
CREATE INDEX "ListingNotificationLog_sentAt_idx" ON "ListingNotificationLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProBoostCredit_userId_monthKey_key" ON "ProBoostCredit"("userId", "monthKey");

-- AddForeignKey
ALTER TABLE "ListingNotificationLog" ADD CONSTRAINT "ListingNotificationLog_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProBoostCredit" ADD CONSTRAINT "ProBoostCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
