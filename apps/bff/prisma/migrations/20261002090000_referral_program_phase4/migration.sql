-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstSeenViewerKey" TEXT,
ADD COLUMN     "referralFrozenAt" TIMESTAMP(3),
ADD COLUMN     "referralFrozenReason" TEXT;

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "rewardSkippedReason" TEXT;

-- CreateTable
CREATE TABLE "ReferralPhoneLedger" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "referralId" TEXT,
    "rewardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralPhoneLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralAdminAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "referralId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPhoneLedger_phoneHash_key" ON "ReferralPhoneLedger"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPhoneLedger_referralId_key" ON "ReferralPhoneLedger"("referralId");

-- CreateIndex
CREATE INDEX "ReferralAdminAction_targetUserId_createdAt_idx" ON "ReferralAdminAction"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReferralPhoneLedger" ADD CONSTRAINT "ReferralPhoneLedger_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAdminAction" ADD CONSTRAINT "ReferralAdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAdminAction" ADD CONSTRAINT "ReferralAdminAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAdminAction" ADD CONSTRAINT "ReferralAdminAction_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

