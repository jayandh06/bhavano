-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "rewardSkippedReason" TEXT;

-- AlterTable
ALTER TABLE "ReferralClick" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'open';

-- AlterTable
ALTER TABLE "ReferralCreditBatch" ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

