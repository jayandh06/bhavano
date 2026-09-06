-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acquisitionAdGroupId" TEXT,
ADD COLUMN     "acquisitionAdId" TEXT,
ADD COLUMN     "acquisitionCampaignId" TEXT,
ADD COLUMN     "acquisitionGclid" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "adGroupId" TEXT,
ADD COLUMN     "adId" TEXT,
ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "gclid" TEXT;
