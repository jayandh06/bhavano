-- AlterTable
ALTER TABLE "Visit" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- Backfill: every session starts as last active when it started...
UPDATE "Visit" SET "lastActivityAt" = "createdAt";

-- ...and the recent ones move to the time of their newest page view (older sessions are mostly crawler rows with
-- one view, where the two are the same, so they are left alone to keep this quick).
UPDATE "Visit" v
SET "lastActivityAt" = pv.last_seen
FROM (
  SELECT "sessionId", max("createdAt") AS last_seen
  FROM "PageView"
  WHERE "createdAt" > now() - interval '120 days'
  GROUP BY "sessionId"
) pv
WHERE pv."sessionId" = v."sessionId" AND v."createdAt" > now() - interval '120 days' AND pv.last_seen > v."lastActivityAt";

-- CreateIndex
CREATE INDEX "Visit_lastActivityAt_idx" ON "Visit"("lastActivityAt");
