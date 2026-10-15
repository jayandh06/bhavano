-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('razorpay', 'apple');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "appleOriginalTransactionId" TEXT,
ADD COLUMN     "appleProductId" TEXT,
ADD COLUMN     "appleTransactionId" TEXT,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'razorpay';

-- CreateTable
CREATE TABLE "ApplePurchaseIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "listingId" TEXT,
    "boostDays" INTEGER,
    "subscriptionMonths" INTEGER,
    "creditPackSize" INTEGER,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "ApplePurchaseIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplePurchaseIntent_paymentId_key" ON "ApplePurchaseIntent"("paymentId");

-- CreateIndex
CREATE INDEX "ApplePurchaseIntent_userId_createdAt_idx" ON "ApplePurchaseIntent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_appleTransactionId_key" ON "Payment"("appleTransactionId");

-- CreateIndex
CREATE INDEX "Payment_appleOriginalTransactionId_idx" ON "Payment"("appleOriginalTransactionId");

-- AddForeignKey
ALTER TABLE "ApplePurchaseIntent" ADD CONSTRAINT "ApplePurchaseIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

