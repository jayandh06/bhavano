-- CreateTable
CREATE TABLE "CityOverview" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "about" TEXT[],
    "gettingAround" TEXT[],
    "faqs" JSONB NOT NULL,
    "status" "AreaOverviewStatus" NOT NULL DEFAULT 'draft',
    "updatedById" TEXT,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityOverview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityOverview_cityId_key" ON "CityOverview"("cityId");

-- CreateIndex
CREATE INDEX "CityOverview_status_idx" ON "CityOverview"("status");

-- AddForeignKey
ALTER TABLE "CityOverview" ADD CONSTRAINT "CityOverview_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
