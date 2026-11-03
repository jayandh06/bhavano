-- Operator pilot queries (docs/plans/pg-coworking-pilot-kit.md). Read-only. Run in psql against the production database.
-- The Bulk Import account (phone 9000000002) owns unclaimed imports and is excluded everywhere: only claimed or self-posted ads can be granted Featured.

-- 1. CANDIDATES: live PG and coworking ads of real operators, with their last 30 days of demand. Pick about 20 (see the kit for the rules).
SELECT u.id AS user_id, u.name, u.phone, c.name AS city, a.name AS area, l.category, l.id AS listing_id, l.title,
       l."createdAt"::date AS posted, l."expiresAt"::date AS expires,
       (l."boostedUntil" > now()) AS featured_now,
       (SELECT COUNT(DISTINCT v."viewerKey") FROM "ListingView" v WHERE v."listingId" = l.id AND v."createdAt" > now() - interval '30 days') AS views_30d,
       (SELECT COUNT(*) FROM "ContactReveal" r WHERE r."listingId" = l.id AND r."createdAt" > now() - interval '30 days') AS reveals_30d,
       (SELECT COUNT(*) FROM "Conversation" cv WHERE cv."listingId" = l.id AND cv.type = 'inquiry' AND cv."createdAt" > now() - interval '30 days') AS enquiries_30d,
       (SELECT COUNT(*) FROM "Listing" l2 WHERE l2."ownerId" = u.id AND l2.status = 'active' AND l2."publishState" = 'live') AS live_ads_of_owner
FROM "Listing" l
JOIN "User" u ON u.id = l."ownerId"
JOIN "City" c ON c.id = l."cityId"
JOIN "Area" a ON a.id = l."areaId"
WHERE l.category IN ('pg', 'coworking')
  AND l.status = 'active' AND l."publishState" = 'live' AND l."moderationState" = 'approved' AND l."expiresAt" > now()
  AND u.role = 'user' AND u.phone IS NOT NULL AND u.phone <> '9000000002'
ORDER BY c.name, l.category, enquiries_30d DESC, views_30d DESC;

-- 2. WEEKLY NUMBERS for the pilot ads: replace the ids in the list. This week against the week before.
WITH pilot(listing_id) AS (VALUES ('REPLACE_WITH_LISTING_ID_1'), ('REPLACE_WITH_LISTING_ID_2'))
SELECT l.title, c.name AS city,
       (SELECT COUNT(DISTINCT v."viewerKey") FROM "ListingView" v WHERE v."listingId" = l.id AND v."createdAt" > now() - interval '7 days') AS views_this_week,
       (SELECT COUNT(DISTINCT v."viewerKey") FROM "ListingView" v WHERE v."listingId" = l.id AND v."createdAt" BETWEEN now() - interval '14 days' AND now() - interval '7 days') AS views_last_week,
       (SELECT COUNT(*) FROM "Favourite" f WHERE f."listingId" = l.id AND f."createdAt" > now() - interval '7 days') AS saves_this_week,
       (SELECT COUNT(*) FROM "ContactReveal" r WHERE r."listingId" = l.id AND r."createdAt" > now() - interval '7 days') AS reveals_this_week,
       (SELECT COUNT(*) FROM "ContactReveal" r WHERE r."listingId" = l.id AND r."createdAt" BETWEEN now() - interval '14 days' AND now() - interval '7 days') AS reveals_last_week,
       (SELECT COUNT(*) FROM "Conversation" cv WHERE cv."listingId" = l.id AND cv.type = 'inquiry' AND cv."createdAt" > now() - interval '7 days') AS enquiries_this_week,
       (SELECT COUNT(*) FROM "Conversation" cv WHERE cv."listingId" = l.id AND cv.type = 'inquiry' AND cv."createdAt" BETWEEN now() - interval '14 days' AND now() - interval '7 days') AS enquiries_last_week
FROM "Listing" l JOIN "City" c ON c.id = l."cityId"
WHERE l.id IN (SELECT listing_id FROM pilot)
ORDER BY c.name, l.title;

-- 3. WHO GOT A GRANT and until when (the audit trail of the pilot).
SELECT p."createdAt"::date AS granted, p.source, u.name, u.phone, l.title, p."boostDays" AS days, l."boostedUntil"::date AS featured_until
FROM "Payment" p JOIN "User" u ON u.id = p."userId" JOIN "Listing" l ON l.id = p."listingId"
WHERE p.source LIKE 'admin_grant:%'
ORDER BY p."createdAt" DESC;

-- 4. DEMAND IN THE SEGMENT (the gate for charging): enquiries and reveals on PG and coworking ads, last 30 days, all operators.
SELECT l.category,
       COUNT(DISTINCT cv.id) FILTER (WHERE cv.type = 'inquiry') AS enquiries_30d,
       (SELECT COUNT(*) FROM "ContactReveal" r JOIN "Listing" l3 ON l3.id = r."listingId" WHERE l3.category = l.category AND r."createdAt" > now() - interval '30 days') AS reveals_30d
FROM "Listing" l LEFT JOIN "Conversation" cv ON cv."listingId" = l.id AND cv."createdAt" > now() - interval '30 days'
WHERE l.category IN ('pg', 'coworking') AND l.status = 'active' AND l."publishState" = 'live'
GROUP BY l.category;
