ALTER TYPE "ListingPublishState" ADD VALUE 'awaiting_claim';

ALTER TYPE "ClaimSource" ADD VALUE 'assisted';

ALTER TABLE "Listing" ADD COLUMN "claimPhoneE164" TEXT,
ADD COLUMN "claimName" TEXT,
ADD COLUMN "claimSellerType" "SellerType",
ADD COLUMN "createdByAdminId" TEXT;
