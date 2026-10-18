-- Read-only. Lists existing areas whose names look like addresses or junk rather than localities,
-- with how many active listings each has, so they can be merged or renamed by hand in admin.
-- See docs/plans/area-page-indexing-and-name-cleanup.md. Nothing is written.
--   set -a && . ./apps/bff/.env && set +a && psql "$DATABASE_URL" -f apps/bff/scripts/suspicious-areas.sql
SELECT c."name" AS city,
       a."name" AS area,
       a."source",
       COUNT(l.id) FILTER (WHERE l."status" = 'active' AND l."publishState" = 'live') AS active_listings,
       CASE
         WHEN lower(a."name") = lower(c."name")        THEN 'same as city name'
         WHEN a."name" ~ '\d{6}'                       THEN 'contains a pin code'
         WHEN length(a."name") > 40                    THEN 'longer than 40 characters'
         WHEN a."name" ~ '^[a-z]'                      THEN 'starts lowercase'
         WHEN a."name" ~* '\m(po|pin|gali|near|opp|opposite)\M' THEN 'looks like an address'
       END AS why
FROM "Area" a
JOIN "City" c ON c.id = a."cityId"
LEFT JOIN "Listing" l ON l."areaId" = a.id
WHERE lower(a."name") = lower(c."name")
   OR a."name" ~ '\d{6}'
   OR length(a."name") > 40
   OR a."name" ~ '^[a-z]'
   OR a."name" ~* '\m(po|pin|gali|near|opp|opposite)\M'
GROUP BY c."name", a."name", a."source"
ORDER BY active_listings DESC, city, area;
