-- CreateTable
CREATE TABLE "PostedConfirmationSetting" (
    "id" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostedConfirmationSetting_pkey" PRIMARY KEY ("id")
);
