-- ListingNotificationLog's counterpart for a notification with no listing — today, just
-- "welcome". A separate table rather than widening ListingNotificationLog with an optional
-- listingId, so the expiry-reminder job's already-working queries against that table need no
-- change for a case they were never meant to cover.
CREATE TABLE "UserNotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserNotificationLog_userId_kind_idx" ON "UserNotificationLog"("userId", "kind");

CREATE INDEX "UserNotificationLog_sentAt_idx" ON "UserNotificationLog"("sentAt");

ALTER TABLE "UserNotificationLog" ADD CONSTRAINT "UserNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
