-- AlterEnum
ALTER TYPE "LoginMethod" ADD VALUE 'apple';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");

