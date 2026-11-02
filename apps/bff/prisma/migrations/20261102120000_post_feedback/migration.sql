-- CreateTable
CREATE TABLE "PostFeedback" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "difficulties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestion" TEXT,
    "canContact" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "category" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostFeedback_listingId_key" ON "PostFeedback"("listingId");

-- CreateIndex
CREATE INDEX "PostFeedback_createdAt_idx" ON "PostFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "PostFeedback_userId_idx" ON "PostFeedback"("userId");

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
