-- CreateEnum
CREATE TYPE "LoginMethod" AS ENUM ('otp', 'google');

-- CreateEnum
CREATE TYPE "RateLimitKind" AS ENUM ('publish', 'view');

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "LoginMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "kind" "RateLimitKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitSetting" (
    "id" TEXT NOT NULL,
    "publishLimit" INTEGER NOT NULL DEFAULT 5,
    "publishWindowMinutes" INTEGER NOT NULL DEFAULT 1440,
    "viewLimit" INTEGER NOT NULL DEFAULT 200,
    "viewWindowMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RateLimitHit_identity_kind_createdAt_idx" ON "RateLimitHit"("identity", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ListingView_viewerKey_idx" ON "ListingView"("viewerKey");

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

