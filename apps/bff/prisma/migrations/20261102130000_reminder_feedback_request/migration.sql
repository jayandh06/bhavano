-- AlterTable
ALTER TABLE "ReminderSetting" ADD COLUMN     "feedbackRequestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "feedbackRequestHours" INTEGER NOT NULL DEFAULT 48;
