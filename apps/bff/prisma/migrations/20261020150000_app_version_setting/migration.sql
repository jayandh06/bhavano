-- CreateTable
CREATE TABLE "AppVersionSetting" (
    "id" TEXT NOT NULL,
    "androidMinVersion" TEXT NOT NULL DEFAULT '',
    "iosMinVersion" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppVersionSetting_pkey" PRIMARY KEY ("id")
);
