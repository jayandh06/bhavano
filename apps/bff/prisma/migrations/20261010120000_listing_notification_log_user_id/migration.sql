-- AlterTable
ALTER TABLE "ListingNotificationLog" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "ListingNotificationLog_userId_idx" ON "ListingNotificationLog"("userId");

-- AddForeignKey
ALTER TABLE "ListingNotificationLog" ADD CONSTRAINT "ListingNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
