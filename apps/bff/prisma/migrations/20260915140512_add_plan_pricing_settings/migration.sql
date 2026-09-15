-- CreateTable
CREATE TABLE "BoostPriceSetting" (
    "id" TEXT NOT NULL,
    "propertyBoostPrice7d" INTEGER NOT NULL DEFAULT 199,
    "propertyBoostPrice15d" INTEGER NOT NULL DEFAULT 349,
    "coworkingPgStorageBoostPrice7d" INTEGER NOT NULL DEFAULT 99,
    "coworkingPgStorageBoostPrice15d" INTEGER NOT NULL DEFAULT 179,
    "furnitureInteriorsBoostPrice7d" INTEGER NOT NULL DEFAULT 49,
    "furnitureInteriorsBoostPrice15d" INTEGER NOT NULL DEFAULT 89,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoostPriceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlanSetting" (
    "id" TEXT NOT NULL,
    "freeListingSlots" INTEGER NOT NULL DEFAULT 5,
    "sellerSlotPackTotalSlots" INTEGER NOT NULL DEFAULT 10,
    "sellerSlotPackMonthlyPrice" INTEGER NOT NULL DEFAULT 149,
    "proListingSlotsPerUnit" INTEGER NOT NULL DEFAULT 20,
    "agentProMonthlyPricePerUnit" INTEGER NOT NULL DEFAULT 499,
    "buyerPremiumPrice1Month" INTEGER NOT NULL DEFAULT 99,
    "buyerPremiumPrice6Months" INTEGER NOT NULL DEFAULT 549,
    "buyerPremiumPrice12Months" INTEGER NOT NULL DEFAULT 899,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlanSetting_pkey" PRIMARY KEY ("id")
);
