// The US launch cities and their neighbourhoods (prisma/data/usCities.json; docs/plans/us-cities-seed.md). Every write is an upsert on a unique
// constraint, so it is safe to run again. It refuses to run unless MARKET=us, so it cannot add US cities to India's database.
//
//   npx tsx prisma/seedUsCities.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export type UsCitySeed = {
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** How far from the centre a map pin still files under this city (see the City model). */
  catchmentKm: number;
  areas: { name: string; lat: number; lng: number }[];
};

/** Names people and Google use for a seeded city. A neighbourhood needs no row: the catchment covers it. */
export const US_CITY_ALIASES: { name: string; cityName: string }[] = [
  { name: 'New York City', cityName: 'New York' },
  { name: 'NYC', cityName: 'New York' },
  { name: 'Washington DC', cityName: 'Washington' },
  { name: 'Washington, D.C.', cityName: 'Washington' },
  { name: 'SF', cityName: 'San Francisco' },
  { name: 'LA', cityName: 'Los Angeles' },
];

export function loadUsCities(): UsCitySeed[] {
  const dataPath = process.env.US_CITIES_PATH || path.join(__dirname, 'data', 'usCities.json');
  return JSON.parse(fs.readFileSync(dataPath, 'utf8')) as UsCitySeed[];
}

export async function seedUsCities(prisma: PrismaClient, market: string | undefined = process.env.MARKET): Promise<{ cities: number; areas: number }> {
  if (market !== 'us') {
    throw new Error(`seedUsCities refuses to run with MARKET=${market ?? '(unset)'}: these cities belong only in the US database.`);
  }

  const ids = new Map<string, string>();
  let areas = 0;
  for (const { areas: cityAreas, ...city } of loadUsCities()) {
    // All of them are served and listed first in the pickers, header and footer, like India's ad-target cities.
    const data = { ...city, isPopular: true, isServed: true, source: 'curated' };
    const row = await prisma.city.upsert({
      where: { name_state: { name: city.name, state: city.state } },
      update: data,
      create: data,
    });
    ids.set(city.name, row.id);
    for (const area of cityAreas) {
      await prisma.area.upsert({
        where: { name_cityId: { name: area.name, cityId: row.id } },
        update: { lat: area.lat, lng: area.lng, source: 'curated' },
        create: { ...area, cityId: row.id, source: 'curated' },
      });
      areas += 1;
    }
  }

  for (const alias of US_CITY_ALIASES) {
    const cityId = ids.get(alias.cityName);
    if (!cityId) continue;
    await prisma.localityAlias.upsert({ where: { name: alias.name }, update: { cityId }, create: { name: alias.name, cityId } });
  }

  return { cities: ids.size, areas };
}

if (require.main === module) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  seedUsCities(prisma)
    .then((r) => console.log(`US city seed complete: ${r.cities} cities, ${r.areas} areas.`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
