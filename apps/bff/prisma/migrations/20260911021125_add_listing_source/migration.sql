-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('direct', 'manual', 'google_api');

-- DropIndex
DROP INDEX "Listing_title_trgm_idx";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "source" "ListingSource" NOT NULL DEFAULT 'direct';

-- AlterTable
ALTER TABLE "ListingPhoto" ALTER COLUMN "updatedAt" DROP DEFAULT;
