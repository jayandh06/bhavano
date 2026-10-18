-- Read-only. Ranks areas by active, live listings, to choose which areas get an overview first
-- (docs/plans/area-overview-pages.md). Aggregate counts only: no names, phones or emails.
--
-- The production database is not a container on the app server, so run it wherever you normally
-- reach it with psql (the connection string is DATABASE_URL in the BFF's environment):
--   set -a && . ./apps/bff/.env && set +a && psql "$DATABASE_URL" -f apps/bff/scripts/top-areas-by-listings.sql
-- or paste the queries into any open SQL session. Both are SELECTs; nothing is written.
--
-- The second query takes the top areas inside each city, so smaller cities are represented.

-- 1. Top 60 areas overall, with the URL path the page lives at.
SELECT c."name"                                   AS city,
       a."name"                                   AS area,
       COUNT(*)                                   AS active_listings,
       COUNT(*) FILTER (WHERE l."createdAt" > now() - interval '30 days') AS new_last_30d,
       '/' || lower(regexp_replace(c."name", '[^a-zA-Z0-9]+', '-', 'g'))
           || '/' || lower(regexp_replace(a."name", '[^a-zA-Z0-9]+', '-', 'g')) AS path
FROM "Listing" l
JOIN "Area" a ON a.id = l."areaId"
JOIN "City" c ON c.id = l."cityId"
WHERE l."status" = 'active' AND l."publishState" = 'live'
GROUP BY c."name", a."name"
ORDER BY active_listings DESC
LIMIT 60;

-- 2. Top 8 areas inside each city, so smaller cities are represented.
SELECT city, area, active_listings
FROM (
  SELECT c."name" AS city, a."name" AS area, COUNT(*) AS active_listings,
         ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY COUNT(*) DESC) AS rank_in_city
  FROM "Listing" l
  JOIN "Area" a ON a.id = l."areaId"
  JOIN "City" c ON c.id = l."cityId"
  WHERE l."status" = 'active' AND l."publishState" = 'live'
  GROUP BY c.id, c."name", a."name"
) ranked
WHERE rank_in_city <= 8
ORDER BY city, active_listings DESC;
