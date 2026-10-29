-- CreateTable
CREATE TABLE "OwnerAlertSetting" (
    "id" TEXT NOT NULL,
    "whatsappForFreeAds" BOOLEAN NOT NULL DEFAULT false,
    "smsForFreeAds" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerAlertSetting_pkey" PRIMARY KEY ("id")
);
