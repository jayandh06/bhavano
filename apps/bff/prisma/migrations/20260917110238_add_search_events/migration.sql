-- CreateTable
CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "path" TEXT NOT NULL,
    "q" TEXT,
    "cityId" TEXT,
    "areaIds" TEXT[],
    "category" "ListingCategory",
    "transactionType" "TransactionType",
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "bedrooms" INTEGER[],
    "furnished" TEXT,
    "sort" TEXT,
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SearchEvent_cityId_category_idx" ON "SearchEvent"("cityId", "category");

-- CreateIndex
CREATE INDEX "SearchEvent_resultCount_createdAt_idx" ON "SearchEvent"("resultCount", "createdAt");

-- CreateIndex
CREATE INDEX "SearchEvent_sessionId_idx" ON "SearchEvent"("sessionId");

-- AddForeignKey
ALTER TABLE "SearchEvent" ADD CONSTRAINT "SearchEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchEvent" ADD CONSTRAINT "SearchEvent_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

