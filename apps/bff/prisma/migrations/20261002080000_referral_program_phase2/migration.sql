-- CreateTable
CREATE TABLE "ReferralCreditBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "daysGranted" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedListingId" TEXT,
    "redeemedPaymentId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "bonusTier" TEXT,

    CONSTRAINT "ReferralCreditBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSetting" (
    "id" TEXT NOT NULL,
    "boostDays" INTEGER NOT NULL DEFAULT 3,
    "creditExpiryDays" INTEGER NOT NULL DEFAULT 60,
    "monthlyCapPerReferrer" INTEGER NOT NULL DEFAULT 5,
    "bonusExtraBoostAtReferrals" INTEGER NOT NULL DEFAULT 3,
    "topAgentBadgeAtReferrals" INTEGER NOT NULL DEFAULT 5,
    "welcomeRewardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeRewardFeaturedDays" INTEGER NOT NULL DEFAULT 1,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
    "takedownRevocationWindowDays" INTEGER NOT NULL DEFAULT 14,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCreditBatch_referralId_key" ON "ReferralCreditBatch"("referralId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCreditBatch_redeemedPaymentId_key" ON "ReferralCreditBatch"("redeemedPaymentId");

-- CreateIndex
CREATE INDEX "ReferralCreditBatch_userId_expiresAt_idx" ON "ReferralCreditBatch"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "ReferralCreditBatch" ADD CONSTRAINT "ReferralCreditBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCreditBatch" ADD CONSTRAINT "ReferralCreditBatch_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCreditBatch" ADD CONSTRAINT "ReferralCreditBatch_redeemedPaymentId_fkey" FOREIGN KEY ("redeemedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

