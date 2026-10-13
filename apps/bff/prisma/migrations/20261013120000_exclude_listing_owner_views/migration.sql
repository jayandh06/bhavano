-- Reclassify distinct-view counters and remove known admin/owner visits from organic totals.
ALTER TABLE "Listing" RENAME COLUMN "uniqueViewerCount" TO "organicViewCount";
ALTER TABLE "Listing" ADD COLUMN "anonymousViewCount" INTEGER NOT NULL DEFAULT 0;

WITH excluded_views AS (
  SELECT lv."listingId", COUNT(*)::int AS visit_count
  FROM "ListingView" lv
  JOIN "Listing" l ON l.id = lv."listingId"
  JOIN "User" u ON lv."viewerKey" = 'user:' || u.id
  WHERE u.role = 'admin' OR l."ownerId" = u.id
  GROUP BY lv."listingId"
)
UPDATE "Listing" l
SET "viewCount" = GREATEST(l."viewCount" - ev.visit_count, 0)
FROM excluded_views ev
WHERE l.id = ev."listingId";

DELETE FROM "ListingView" lv
USING "Listing" l, "User" u
WHERE l.id = lv."listingId"
  AND lv."viewerKey" = 'user:' || u.id
  AND (u.role = 'admin' OR l."ownerId" = u.id);

UPDATE "Listing" l
SET
  "organicViewCount" = COALESCE((
    SELECT COUNT(DISTINCT lv."viewerKey")::int
    FROM "ListingView" lv
    JOIN "User" u ON lv."viewerKey" = 'user:' || u.id
    WHERE lv."listingId" = l.id
      AND u.role <> 'admin'
      AND u.id <> l."ownerId"
  ), 0),
  "anonymousViewCount" = COALESCE((
    SELECT COUNT(DISTINCT lv."viewerKey")::int
    FROM "ListingView" lv
    WHERE lv."listingId" = l.id
      AND lv."viewerKey" LIKE 'anon:%'
  ), 0);
