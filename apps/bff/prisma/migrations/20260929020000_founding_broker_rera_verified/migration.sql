ALTER TABLE "User" ADD COLUMN "reraVerifiedAt" TIMESTAMP(3);

ALTER TABLE "UserSubscription" ALTER COLUMN "paymentId" DROP NOT NULL,
ADD COLUMN "grantReason" TEXT;
