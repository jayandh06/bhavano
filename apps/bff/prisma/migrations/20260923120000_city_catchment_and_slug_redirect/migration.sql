-- AlterTable
ALTER TABLE "City" ADD COLUMN "catchmentKm" INTEGER NOT NULL DEFAULT 25;

-- Wider than 25 km where seeded areas sit past that distance from the centroid.
UPDATE "City" SET "catchmentKm" = 50 WHERE name = 'Delhi NCR';
UPDATE "City" SET "catchmentKm" = 35 WHERE name IN ('Bengaluru', 'Mumbai', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad');

-- CreateTable
CREATE TABLE "CitySlugRedirect" (
    "slug" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitySlugRedirect_pkey" PRIMARY KEY ("slug")
);

-- AddForeignKey
ALTER TABLE "CitySlugRedirect" ADD CONSTRAINT "CitySlugRedirect_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
