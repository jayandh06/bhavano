-- CreateTable
CREATE TABLE "PlacesFetchLog" (
    "id" TEXT NOT NULL,
    "citySearched" TEXT NOT NULL,
    "cityId" TEXT,
    "areaSearched" TEXT,
    "areaId" TEXT,
    "businessCategory" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultsFound" INTEGER NOT NULL,
    "resultsImported" INTEGER NOT NULL,
    "minRatingFilter" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacesFetchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacesFetchLog_cityId_areaId_businessCategory_idx" ON "PlacesFetchLog"("cityId", "areaId", "businessCategory");

-- CreateIndex
CREATE INDEX "PlacesFetchLog_fetchedAt_idx" ON "PlacesFetchLog"("fetchedAt");

-- AddForeignKey
ALTER TABLE "PlacesFetchLog" ADD CONSTRAINT "PlacesFetchLog_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacesFetchLog" ADD CONSTRAINT "PlacesFetchLog_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

