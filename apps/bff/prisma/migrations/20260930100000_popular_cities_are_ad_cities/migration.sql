-- "Popular" becomes the 11 cities the Google Ads campaigns target since 2026-09-28: Lucknow and
-- Coimbatore join, Surat, Kochi and Chandigarh leave. Reach (catchmentKm) is not touched.
-- See docs/plans/focus-on-ad-target-cities.md.
UPDATE "City" c SET "isPopular" = EXISTS (
  SELECT 1 FROM (VALUES
    ('Bengaluru', 'Karnataka'), ('Delhi NCR', 'Delhi'), ('Hyderabad', 'Telangana'), ('Pune', 'Maharashtra'),
    ('Chennai', 'Tamil Nadu'), ('Mumbai', 'Maharashtra'), ('Kolkata', 'West Bengal'), ('Ahmedabad', 'Gujarat'),
    ('Jaipur', 'Rajasthan'), ('Lucknow', 'Uttar Pradesh'), ('Coimbatore', 'Tamil Nadu')
  ) AS s(name, state)
  WHERE c.name = s.name AND c.state = s.state
)
WHERE c."isServed" OR c."isPopular";
