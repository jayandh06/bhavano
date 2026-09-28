-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('owner', 'agent');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sellerType" "SellerType",
ADD COLUMN "agencyName" TEXT,
ADD COLUMN "reraNumber" TEXT;
