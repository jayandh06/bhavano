-- CreateTable
CREATE TABLE "ListingEditLog" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingEditLog_listingId_createdAt_idx" ON "ListingEditLog"("listingId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListingEditLog" ADD CONSTRAINT "ListingEditLog_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEditLog" ADD CONSTRAINT "ListingEditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
