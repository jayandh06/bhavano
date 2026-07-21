-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('created', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('listing_boost');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "boostRank" DOUBLE PRECISION,
ADD COLUMN     "boostedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'created',
    "purpose" "PaymentPurpose" NOT NULL,
    "listingId" TEXT,
    "boostDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingBoost" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "boostedFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boostedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingBoost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListingBoost_paymentId_key" ON "ListingBoost"("paymentId");

-- CreateIndex
CREATE INDEX "ListingBoost_listingId_idx" ON "ListingBoost"("listingId");

-- CreateIndex
CREATE INDEX "Listing_boostedUntil_idx" ON "Listing"("boostedUntil");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingBoost" ADD CONSTRAINT "ListingBoost_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingBoost" ADD CONSTRAINT "ListingBoost_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
