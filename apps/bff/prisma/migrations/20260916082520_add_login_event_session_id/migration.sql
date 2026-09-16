-- AlterTable
ALTER TABLE "LoginEvent" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "LoginEvent_sessionId_idx" ON "LoginEvent"("sessionId");

