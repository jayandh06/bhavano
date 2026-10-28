-- CreateTable
CREATE TABLE "LoginSetting" (
    "id" TEXT NOT NULL,
    "emailLogin" TEXT NOT NULL DEFAULT 'all',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginSetting_pkey" PRIMARY KEY ("id")
);
