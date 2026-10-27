-- CreateTable
CREATE TABLE "OwnerAlertPreference" (
    "userId" TEXT NOT NULL,
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerAlertPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "OwnerAlertPreference" ADD CONSTRAINT "OwnerAlertPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
