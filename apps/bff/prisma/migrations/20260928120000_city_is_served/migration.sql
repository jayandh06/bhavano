-- AlterTable
ALTER TABLE "City" ADD COLUMN "isServed" BOOLEAN NOT NULL DEFAULT false;

-- The 37 cities the Google Ads Metro and Other-Metro campaigns target (seedCities.ts).
UPDATE "City" c SET "isServed" = true
FROM (VALUES
  ('Bengaluru', 'Karnataka'), ('Mumbai', 'Maharashtra'), ('Delhi NCR', 'Delhi'), ('Pune', 'Maharashtra'),
  ('Hyderabad', 'Telangana'), ('Chennai', 'Tamil Nadu'), ('Kolkata', 'West Bengal'), ('Ahmedabad', 'Gujarat'),
  ('Surat', 'Gujarat'), ('Jaipur', 'Rajasthan'), ('Kochi', 'Kerala'), ('Chandigarh', 'Chandigarh'),
  ('Nagpur', 'Maharashtra'), ('Indore', 'Madhya Pradesh'), ('Bhopal', 'Madhya Pradesh'), ('Coimbatore', 'Tamil Nadu'),
  ('Visakhapatnam', 'Andhra Pradesh'), ('Vijayawada', 'Andhra Pradesh'), ('Lucknow', 'Uttar Pradesh'),
  ('Kanpur', 'Uttar Pradesh'), ('Nashik', 'Maharashtra'), ('Vadodara', 'Gujarat'), ('Rajkot', 'Gujarat'),
  ('Patna', 'Bihar'), ('Ranchi', 'Jharkhand'), ('Bhubaneswar', 'Odisha'), ('Guwahati', 'Assam'),
  ('Mysuru', 'Karnataka'), ('Mangaluru', 'Karnataka'), ('Thiruvananthapuram', 'Kerala'), ('Kozhikode', 'Kerala'),
  ('Madurai', 'Tamil Nadu'), ('Amritsar', 'Punjab'), ('Ludhiana', 'Punjab'), ('Dehradun', 'Uttarakhand'),
  ('Raipur', 'Chhattisgarh'), ('Panaji', 'Goa')
) AS s(name, state)
WHERE c.name = s.name AND c.state = s.state;

-- Reach: popular metros 75 km (Delhi NCR 90), the other served cities 40 km. Census towns keep 25.
UPDATE "City" SET "catchmentKm" = 40 WHERE "isServed" AND NOT "isPopular";
UPDATE "City" SET "catchmentKm" = 75 WHERE "isServed" AND "isPopular";
UPDATE "City" SET "catchmentKm" = 90 WHERE "isServed" AND name = 'Delhi NCR';
