-- AlterTable
ALTER TABLE "User" ADD COLUMN "mergedIntoUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "mergedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mergedPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "mergedEmail" TEXT;

-- CreateIndex
CREATE INDEX "User_mergedIntoUserId_idx" ON "User"("mergedIntoUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mergedIntoUserId_fkey" FOREIGN KEY ("mergedIntoUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
