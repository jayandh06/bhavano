-- AlterTable
-- "Referral"."rewardSkippedReason" and "ReferralCreditBatch"."expiryReminderSentAt" are
-- deliberately NOT here: a concurrent session's own migration
-- (20261002100000_referral_program_phase6, applied 2026-10-02 in production) already added both.
-- This migration's local-dev diff bundled them in by mistake since dev hadn't picked up that
-- commit yet — production rejected the redundant ADD COLUMN with "column already exists" (P3018)
-- and the whole migration rolled back cleanly (Postgres wraps it in one transaction), so only the
-- genuinely new columns below were ever missing.
ALTER TABLE "ReferralClick" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'open';

