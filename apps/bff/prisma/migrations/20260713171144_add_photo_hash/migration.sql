-- CreateTable
CREATE TABLE "PhotoHash" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoHash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoHash_hash_idx" ON "PhotoHash"("hash");

-- AddForeignKey
ALTER TABLE "PhotoHash" ADD CONSTRAINT "PhotoHash_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
