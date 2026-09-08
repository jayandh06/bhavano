-- AlterTable
ALTER TABLE "ListingNotificationLog" ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "deliveryStatusAt" TIMESTAMP(3),
ADD COLUMN     "providerMessageId" TEXT;

-- CreateTable
CREATE TABLE "WhatsappWebhookEvent" (
    "id" TEXT NOT NULL,
    "rawBody" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingNotificationLog_providerMessageId_idx" ON "ListingNotificationLog"("providerMessageId");
