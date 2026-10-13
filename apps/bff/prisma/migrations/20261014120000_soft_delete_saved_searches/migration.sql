ALTER TABLE "SavedSearch" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "SavedSearch_userId_deletedAt_idx" ON "SavedSearch"("userId", "deletedAt");
