-- AlterEnum
-- US-only category (docs/plans/us-listing-model.md, phase 4). Adding an enum value changes nothing for existing rows or for India.
ALTER TYPE "ListingCategory" ADD VALUE 'manufactured';
