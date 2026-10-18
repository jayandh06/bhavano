-- CreateEnum
CREATE TYPE "AreaOverviewStatus" AS ENUM ('draft', 'in_review', 'published');

-- CreateTable
CREATE TABLE "AreaOverview" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
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

    CONSTRAINT "AreaOverview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AreaOverview_areaId_key" ON "AreaOverview"("areaId");

-- CreateIndex
CREATE INDEX "AreaOverview_status_idx" ON "AreaOverview"("status");

-- AddForeignKey
ALTER TABLE "AreaOverview" ADD CONSTRAINT "AreaOverview_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
