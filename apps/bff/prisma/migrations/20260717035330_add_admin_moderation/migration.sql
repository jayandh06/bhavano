-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "ModerationState" AS ENUM ('approved', 'flagged');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('inquiry', 'moderation');

-- DropIndex
DROP INDEX "Conversation_listingId_inquirerId_key";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'inquiry';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "adminReviewed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderationState" "ModerationState" NOT NULL DEFAULT 'approved';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user';

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_listingId_inquirerId_type_key" ON "Conversation"("listingId", "inquirerId", "type");

