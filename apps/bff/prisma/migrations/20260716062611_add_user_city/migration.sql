-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cityId" TEXT;

-- CreateIndex
CREATE INDEX "User_cityId_idx" ON "User"("cityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
