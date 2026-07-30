-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('google_maps', 'scrape', 'manual_upload', 'referral');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('new', 'enriched', 'contacted', 'engaged', 'converted', 'invalid', 'bounced');

-- CreateEnum
CREATE TYPE "ConsentState" AS ENUM ('none', 'implied', 'explicit', 'opted_out');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'suppressed', 'opted_out');

-- CreateTable
CREATE TABLE "OutreachContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneE164" TEXT,
    "email" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "cityId" TEXT,
    "areaId" TEXT,
    "googleRating" DOUBLE PRECISION,
    "googleReviewCount" INTEGER,
    "googleRatingAt" TIMESTAMP(3),
    "googlePlaceId" TEXT,
    "businessCategory" TEXT,
    "website" TEXT,
    "source" "ContactSource" NOT NULL,
    "sourceRef" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'new',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "consentState" "ConsentState" NOT NULL DEFAULT 'none',
    "consentSource" TEXT,
    "consentAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "contactedCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "bodyTemplate" TEXT NOT NULL,
    "subject" TEXT,
    "dltTemplateId" TEXT,
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "cadenceCron" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "maxSendsPerRun" INTEGER NOT NULL DEFAULT 200,
    "minDaysBetweenSends" INTEGER NOT NULL DEFAULT 14,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "status" "SendStatus" NOT NULL DEFAULT 'queued',
    "runKey" TEXT NOT NULL,
    "providerRef" TEXT,
    "renderedBody" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "channel" "OutreachChannel",
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachContact_googlePlaceId_key" ON "OutreachContact"("googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachContact_userId_key" ON "OutreachContact"("userId");

-- CreateIndex
CREATE INDEX "OutreachContact_cityId_businessCategory_idx" ON "OutreachContact"("cityId", "businessCategory");

-- CreateIndex
CREATE INDEX "OutreachContact_phoneE164_idx" ON "OutreachContact"("phoneE164");

-- CreateIndex
CREATE INDEX "OutreachContact_status_idx" ON "OutreachContact"("status");

-- CreateIndex
CREATE INDEX "OutreachCampaign_status_scheduledAt_idx" ON "OutreachCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "CampaignSend_contactId_sentAt_idx" ON "CampaignSend"("contactId", "sentAt");

-- CreateIndex
CREATE INDEX "CampaignSend_campaignId_status_idx" ON "CampaignSend"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_campaignId_contactId_runKey_key" ON "CampaignSend"("campaignId", "contactId", "runKey");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_value_key" ON "SuppressionEntry"("value");

-- AddForeignKey
ALTER TABLE "OutreachContact" ADD CONSTRAINT "OutreachContact_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachContact" ADD CONSTRAINT "OutreachContact_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachContact" ADD CONSTRAINT "OutreachContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "OutreachContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
