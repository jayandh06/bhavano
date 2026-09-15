-- DropIndex
DROP INDEX "ListingView_listingId_viewerKey_key";

-- CreateIndex
CREATE INDEX "ListingView_listingId_viewerKey_idx" ON "ListingView"("listingId", "viewerKey");
