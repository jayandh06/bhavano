-- CreateTable: audit trail for an admin-initiated account merge — see
-- docs/plans/account-linking-phone-and-email.md's admin-merge addendum. Purely additive; the
-- merge itself (relocating listings/payments/etc.) is AccountMergeService.merge(), unchanged by
-- this migration — this table only records who merged which two accounts, when, and why.
CREATE TABLE "UserMergeAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "loserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMergeAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMergeAction_winnerId_idx" ON "UserMergeAction"("winnerId");

-- CreateIndex
CREATE INDEX "UserMergeAction_loserId_idx" ON "UserMergeAction"("loserId");

-- AddForeignKey
ALTER TABLE "UserMergeAction" ADD CONSTRAINT "UserMergeAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMergeAction" ADD CONSTRAINT "UserMergeAction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMergeAction" ADD CONSTRAINT "UserMergeAction_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
