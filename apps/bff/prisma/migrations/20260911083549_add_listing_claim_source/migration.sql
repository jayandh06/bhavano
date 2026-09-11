-- CreateEnum
CREATE TYPE "ClaimSource" AS ENUM ('email', 'whatsapp');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "claimSource" "ClaimSource";
