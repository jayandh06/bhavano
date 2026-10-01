-- CreateTable
CREATE TABLE "BoostEffectivenessStat" (
    "id" TEXT NOT NULL,
    "avgViews7dBoosted" DOUBLE PRECISION NOT NULL,
    "avgViews7dUnboosted" DOUBLE PRECISION NOT NULL,
    "contactRate7dBoosted" DOUBLE PRECISION NOT NULL,
    "contactRate7dUnboosted" DOUBLE PRECISION NOT NULL,
    "boostedSampleSize" INTEGER NOT NULL,
    "unboostedSampleSize" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoostEffectivenessStat_pkey" PRIMARY KEY ("id")
);
