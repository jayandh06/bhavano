-- AlterTable
ALTER TABLE "User" ADD COLUMN "welcomedAt" TIMESTAMP(3);

-- Backfill: existing users should not retroactively receive a first-login welcome message —
-- only genuinely new signups from this point on should have a null welcomedAt.
UPDATE "User" SET "welcomedAt" = "createdAt" WHERE "welcomedAt" IS NULL;
