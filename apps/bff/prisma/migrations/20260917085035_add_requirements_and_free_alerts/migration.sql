-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('open', 'working', 'closed');

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'plus';

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "cityId" TEXT,
    "areaId" TEXT,
    "category" "ListingCategory",
    "transactionType" "TransactionType",
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "bedrooms" INTEGER,
    "searchLabel" TEXT NOT NULL,
    "landingPath" TEXT,
    "savedSearchId" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'open',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearchSetting" (
    "id" TEXT NOT NULL,
    "freeAlertsPerUser" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearchSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Requirement_status_createdAt_idx" ON "Requirement"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Requirement_cityId_areaId_idx" ON "Requirement"("cityId", "areaId");

-- CreateIndex
CREATE INDEX "Requirement_seekerId_idx" ON "Requirement"("seekerId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_source_idx" ON "SavedSearch"("userId", "source");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

