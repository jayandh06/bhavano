/**
 * Loads the first area and city overview drafts into the database as DRAFTS (never published), so they can
 * be edited and reviewed in the admin app. Safe to re-run: an area that already has an overview
 * row is left alone, so it can never overwrite text someone has edited or approved.
 *
 *   cd apps/bff && set -a && . ./.env && set +a && node_modules/.bin/tsx scripts/seed-area-overview-drafts.ts [--dry-run]
 *
 * Needs the AreaOverview migration applied first. See docs/plans/area-overview-pages.md.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validateAreaOverviewContent } from '@bhavano/types/areaOverview';
import { slugify } from '@bhavano/types/slugify';
import { AREA_OVERVIEW_DRAFTS } from './area-overview-drafts';
import { CITY_OVERVIEW_DRAFTS } from './city-overview-drafts';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const areas = await prisma.area.findMany({ include: { city: true, overview: true } });
  for (const [key, content] of Object.entries(AREA_OVERVIEW_DRAFTS)) {
    const problems = validateAreaOverviewContent(content);
    if (problems.length > 0) {
      console.log(`SKIP   ${key}: ${problems.join(' ')}`);
      continue;
    }
    const matches = areas.filter((a) => `${slugify(a.city.name)}/${slugify(a.name)}` === key);
    if (matches.length !== 1) {
      console.log(`SKIP   ${key}: found ${matches.length} matching areas`);
      continue;
    }
    const area = matches[0];
    if (area.overview) {
      console.log(`exists ${key}: left alone`);
      continue;
    }
    if (!dryRun) {
      await prisma.areaOverview.create({
        data: { areaId: area.id, about: content.about, gettingAround: content.gettingAround, faqs: content.faqs as unknown as Prisma.InputJsonValue },
      });
    }
    console.log(`${dryRun ? 'would add' : 'added   '} ${key} as draft`);
  }
}

async function seedCities() {
  const cities = await prisma.city.findMany({ include: { overview: true } });
  for (const [key, content] of Object.entries(CITY_OVERVIEW_DRAFTS)) {
    const problems = validateAreaOverviewContent(content);
    if (problems.length > 0) {
      console.log(`SKIP   city ${key}: ${problems.join(' ')}`);
      continue;
    }
    const matches = cities.filter((c) => slugify(c.name) === key);
    if (matches.length !== 1) {
      console.log(`SKIP   city ${key}: found ${matches.length} matching cities`);
      continue;
    }
    const city = matches[0];
    if (city.overview) {
      console.log(`exists city ${key}: left alone`);
      continue;
    }
    if (!dryRun) {
      await prisma.cityOverview.create({
        data: { cityId: city.id, about: content.about, gettingAround: content.gettingAround, faqs: content.faqs as unknown as Prisma.InputJsonValue },
      });
    }
    console.log(`${dryRun ? 'would add' : 'added   '} city ${key} as draft`);
  }
}

main().then(seedCities).finally(() => prisma.$disconnect());
