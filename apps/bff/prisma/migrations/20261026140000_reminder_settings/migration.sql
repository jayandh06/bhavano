-- CreateTable
CREATE TABLE "ReminderSetting" (
    "id" TEXT NOT NULL,
    "featuredExpiryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "featuredExpiryDays" INTEGER[] DEFAULT ARRAY[3, 1]::INTEGER[],
    "followupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "followupHours" INTEGER[] DEFAULT ARRAY[4, 24, 72]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSetting_pkey" PRIMARY KEY ("id")
);
