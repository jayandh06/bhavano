-- CreateTable
CREATE TABLE "FeaturedUpsellSetting" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "listingCardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minAgeHours" INTEGER NOT NULL DEFAULT 1,
    "quietDays" INTEGER NOT NULL DEFAULT 3,
    "maxShowsPerAd" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedUpsellSetting_pkey" PRIMARY KEY ("id")
);
