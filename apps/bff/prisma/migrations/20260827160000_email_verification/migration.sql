-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailChallenge_userId_idx" ON "EmailChallenge"("userId");

-- Backfill: an address that came from Google sign-in was asserted by Google, so it is already
-- proven. Addresses typed into the profile form were never verified and stay null — treating
-- them as verified would be exactly the takeover vector this column exists to prevent.
UPDATE "User" SET "emailVerifiedAt" = "createdAt"
WHERE "googleId" IS NOT NULL AND "email" IS NOT NULL;
