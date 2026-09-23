/**
 * One-off: add (or repoint) a LocalityAlias row — patches a specific Google locality/sublocality
 * name that reverse-geocodes to the wrong city, without a code deploy. See
 * docs/plans/fix-wrong-city-geocoding-locality-alias.md and LocalityAlias's own schema comment
 * for why this exists (a ward/village inside an already-curated city getting tagged as its own
 * top-level city).
 *
 * The alias name must match exactly what Google's Geocoding API returns for the mistagged pin
 * (case-insensitive match at lookup time) — confirm it via the BFF's
 * `POST /locations/reverse-geocode` response's `resolvedLocality` field for a pin known to
 * reproduce the bug before adding this, rather than guessing the spelling.
 *
 * Run: pnpm --filter bff exec tsx prisma/addLocalityAlias.ts "New Siddhapudur" "Coimbatore" "Tamil Nadu"
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [aliasName, cityName, cityState] = process.argv.slice(2);
  if (!aliasName || !cityName || !cityState) {
    throw new Error(
      'Usage: tsx prisma/addLocalityAlias.ts "<locality name from Google>" "<city name>" "<state>"',
    );
  }

  const city = await prisma.city.findFirst({
    where: {
      name: { equals: cityName, mode: 'insensitive' },
      state: { equals: cityState, mode: 'insensitive' },
    },
  });
  if (!city) {
    throw new Error(`No city named "${cityName}" in "${cityState}" — check spelling, or seed it first.`);
  }

  const alias = await prisma.localityAlias.upsert({
    where: { name: aliasName },
    update: { cityId: city.id },
    create: { name: aliasName, cityId: city.id },
  });

  console.log(`"${alias.name}" now resolves to ${city.name}, ${city.state} (${city.id}).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
