-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acquisitionFbclid" TEXT,
ADD COLUMN     "acquisitionFbp" TEXT,
ADD COLUMN     "metaConversionSentAt" TIMESTAMP(3);
