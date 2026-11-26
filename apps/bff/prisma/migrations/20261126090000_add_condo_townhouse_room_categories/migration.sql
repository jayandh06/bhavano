-- AlterEnum
-- US-only categories (docs/plans/us-categories-condo-townhouse-room.md). Adding enum values changes nothing for existing rows or for India.
ALTER TYPE "ListingCategory" ADD VALUE 'condo';
ALTER TYPE "ListingCategory" ADD VALUE 'townhouse';
ALTER TYPE "ListingCategory" ADD VALUE 'room';
