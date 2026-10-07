-- AlterTable
ALTER TABLE "RateLimitSetting" ADD COLUMN     "aiGenerateLimit" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "aiGenerateWindowMinutes" INTEGER NOT NULL DEFAULT 1440;
