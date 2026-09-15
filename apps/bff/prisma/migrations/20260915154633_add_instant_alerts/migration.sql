-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'instant_alerts';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "instantAlertsUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InstantAlertsPriceSetting" (
    "id" TEXT NOT NULL,
    "instantAlertsPrice" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstantAlertsPriceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingInstantAlert" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "activatedFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingInstantAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingInstantAlert_paymentId_key" ON "ListingInstantAlert"("paymentId");

-- CreateIndex
CREATE INDEX "ListingInstantAlert_listingId_idx" ON "ListingInstantAlert"("listingId");

-- AddForeignKey
ALTER TABLE "ListingInstantAlert" ADD CONSTRAINT "ListingInstantAlert_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingInstantAlert" ADD CONSTRAINT "ListingInstantAlert_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

