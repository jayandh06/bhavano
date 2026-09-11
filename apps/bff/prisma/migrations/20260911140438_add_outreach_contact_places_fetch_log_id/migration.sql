-- AlterTable
ALTER TABLE "OutreachContact" ADD COLUMN     "placesFetchLogId" TEXT;

-- AlterTable
ALTER TABLE "PlacesFetchLog" ALTER COLUMN "resultsFound" SET DEFAULT 0,
ALTER COLUMN "resultsImported" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "OutreachContact_placesFetchLogId_idx" ON "OutreachContact"("placesFetchLogId");

-- AddForeignKey
ALTER TABLE "OutreachContact" ADD CONSTRAINT "OutreachContact_placesFetchLogId_fkey" FOREIGN KEY ("placesFetchLogId") REFERENCES "PlacesFetchLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

