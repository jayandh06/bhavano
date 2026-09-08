-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'contact_reveal_credits';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "creditPackSize" INTEGER,
ADD COLUMN     "discountCodeId" TEXT;

-- CreateTable
CREATE TABLE "ContactRevealCreditBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "creditsGranted" INTEGER NOT NULL,
    "creditsRemaining" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRevealCreditBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactReveal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "creditBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactReveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRevealSetting" (
    "id" TEXT NOT NULL,
    "freeRevealsPerUser" INTEGER NOT NULL DEFAULT 2,
    "creditPackSize" INTEGER NOT NULL DEFAULT 5,
    "creditPackPriceRupees" INTEGER NOT NULL DEFAULT 125,
    "creditExpiryMonths" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRevealSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "maxRedemptions" INTEGER,
    "maxRedemptionsPerUser" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCodeRedemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactRevealCreditBatch_paymentId_key" ON "ContactRevealCreditBatch"("paymentId");

-- CreateIndex
CREATE INDEX "ContactRevealCreditBatch_userId_expiresAt_idx" ON "ContactRevealCreditBatch"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ContactReveal_userId_createdAt_idx" ON "ContactReveal"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactReveal_listingId_userId_key" ON "ContactReveal"("listingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCodeRedemption_paymentId_key" ON "DiscountCodeRedemption"("paymentId");

-- CreateIndex
CREATE INDEX "DiscountCodeRedemption_discountCodeId_userId_idx" ON "DiscountCodeRedemption"("discountCodeId", "userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRevealCreditBatch" ADD CONSTRAINT "ContactRevealCreditBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRevealCreditBatch" ADD CONSTRAINT "ContactRevealCreditBatch_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactReveal" ADD CONSTRAINT "ContactReveal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactReveal" ADD CONSTRAINT "ContactReveal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactReveal" ADD CONSTRAINT "ContactReveal_creditBatchId_fkey" FOREIGN KEY ("creditBatchId") REFERENCES "ContactRevealCreditBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeRedemption" ADD CONSTRAINT "DiscountCodeRedemption_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeRedemption" ADD CONSTRAINT "DiscountCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeRedemption" ADD CONSTRAINT "DiscountCodeRedemption_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
