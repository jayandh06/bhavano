-- Deferred profile-completion dialog (docs/plans/profile-completion-dialog.md).
ALTER TABLE "User"
  ADD COLUMN "profileNudgeSnoozedUntil" TIMESTAMP(3),
  ADD COLUMN "profileNudgeCount" INTEGER NOT NULL DEFAULT 0;
