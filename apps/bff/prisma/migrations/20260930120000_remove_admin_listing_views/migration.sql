-- Admin visits no longer count as listing views (ListingsController.recordView). Removes the ones
-- recorded before that change: subtracts them from each listing's viewCount, then deletes the rows.
WITH admin_views AS (
  SELECT lv."listingId", count(*)::int AS n
  FROM "ListingView" lv
  JOIN "User" u ON lv."viewerKey" = 'user:' || u.id
  WHERE u.role = 'admin'
  GROUP BY lv."listingId"
)
UPDATE "Listing" l
SET "viewCount" = GREATEST(l."viewCount" - av.n, 0)
FROM admin_views av
WHERE l.id = av."listingId";

DELETE FROM "ListingView" lv
USING "User" u
WHERE lv."viewerKey" = 'user:' || u.id
  AND u.role = 'admin';
