// Census class-I cities (population over 1,00,000) as curated cities.
// Existing rows are left alone: lat/lng and the wider metro catchmentKm stay as seeded.
// A census place whose coordinates already sit inside one of those catchments is skipped,
// so a Delhi neighbourhood or Pimpri-Chinchwad does not become a second city.
// Delhi, New Delhi, Gurgaon, Noida, Greater Noida, Faridabad, and Ghaziabad are absent
// from knownCities.json — they stay LocalityAlias rows under Delhi NCR.
//
//   npx tsx prisma/seedKnownCities.ts
//
// Listings already moved onto a parent city are not moved back.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type KnownCity = { name: string; state: string; lat: number; lng: number; population?: number };

/** Same rule as packages/types slugify. Inlined so this script can run from /tmp in the container. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Names Google uses for a census city we store under the older spelling. */
const SPELLING_ALIASES: { name: string; cityName: string }[] = [
  { name: 'Trichy', cityName: 'Tiruchirappalli' },
  { name: 'Tiruchi', cityName: 'Tiruchirappalli' },
  { name: 'Hubballi', cityName: 'Hubli' },
  { name: 'Belagavi', cityName: 'Belgaum' },
  { name: 'Prayagraj', cityName: 'Allahabad' },
  { name: 'Thoothukudi', cityName: 'Tuticorin' },
  { name: 'Chhatrapati Sambhajinagar', cityName: 'Aurangabad' },
  { name: 'Sambhajinagar', cityName: 'Aurangabad' },
];

function loadKnownCities(): KnownCity[] {
  const dataPath =
    process.env.KNOWN_CITIES_PATH || path.join(__dirname, 'data', 'knownCities.json');
  return JSON.parse(fs.readFileSync(dataPath, 'utf8')) as KnownCity[];
}

export async function seedKnownCities(prisma: PrismaClient) {
  const known = loadKnownCities();
  const existing = await prisma.city.findMany({
    select: { id: true, name: true, lat: true, lng: true, catchmentKm: true },
  });
  const slugToName = new Map(existing.map((c) => [slugify(c.name), c.name]));

  let created = 0;
  const skippedExisting: string[] = [];
  const skippedInside: string[] = [];

  for (const row of known) {
    const slug = slugify(row.name);
    const already = slugToName.get(slug);
    if (already) {
      skippedExisting.push(`${row.name} (already ${already})`);
      continue;
    }

    let inside: { name: string; km: number } | null = null;
    for (const city of existing) {
      const km = distanceKm(row.lat, row.lng, city.lat, city.lng);
      if (km <= city.catchmentKm && (inside === null || km < inside.km)) {
        inside = { name: city.name, km };
      }
    }
    if (inside) {
      skippedInside.push(`${row.name} -> ${inside.name} (${inside.km.toFixed(1)} km)`);
      continue;
    }

    await prisma.city.create({
      data: {
        name: row.name,
        state: row.state,
        lat: row.lat,
        lng: row.lng,
        isPopular: false,
        source: 'curated',
        catchmentKm: 25,
      },
    });
    slugToName.set(slug, row.name);
    created += 1;
  }

  const cities = await prisma.city.findMany({ select: { id: true, name: true } });
  const byName = new Map(cities.map((c) => [c.name.toLowerCase(), c.id]));
  let aliases = 0;
  for (const alias of SPELLING_ALIASES) {
    const cityId = byName.get(alias.cityName.toLowerCase());
    if (!cityId) continue;
    await prisma.localityAlias.upsert({
      where: { name: alias.name },
      update: { cityId },
      create: { name: alias.name, cityId },
    });
    aliases += 1;
  }

  console.log(`Known cities: created ${created}, already present ${skippedExisting.length}, inside an existing catchment ${skippedInside.length}, spelling aliases ${aliases}.`);
  if (skippedInside.length) {
    console.log('Inside an existing catchment (left as areas of that city):');
    for (const line of skippedInside) console.log(`  ${line}`);
  }
  const curated = await prisma.city.count({ where: { source: 'curated' } });
  console.log(`Curated cities now: ${curated}.`);
}

if (require.main === module) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  seedKnownCities(prisma)
    .then(() => console.log('Known-city seed complete.'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
