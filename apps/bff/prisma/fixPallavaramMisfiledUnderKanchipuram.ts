/**
 * One-off cleanup for Chennai-metro rows that the old location resolver filed under Kanchipuram
 * (Google labels Pallavaram/Tambaram with the pre-2019 "Kancheepuram" district). The resolver is
 * already fixed — see docs/plans/district-name-vs-catchment-city.md; this repairs what it left.
 *
 * Deliberately narrow: only the rows named below, each re-checked against the database first, and
 * anything that doesn't match what was inspected is skipped and reported, never guessed at.
 *
 * - Listings: moved to Chennai only if they are currently under Kanchipuram AND their own pin is
 *   inside Chennai's catchment. Their area is moved with them, so the (city, area) pair stays
 *   consistent. The old /kanchipuram/... URL keeps working — the web listing route 301s to the
 *   canonical path.
 * - Areas: moved to Chennai when Chennai has no area of that name.
 * - Duplicate areas: deleted only when Chennai already has a same-named twin AND nothing at all
 *   references the Kanchipuram copy.
 *
 * Run: pnpm --filter bff exec tsx prisma/fixPallavaramMisfiledUnderKanchipuram.ts --dry-run
 *      pnpm --filter bff exec tsx prisma/fixPallavaramMisfiledUnderKanchipuram.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const LISTING_IDS = [
  '283afeab-c351-47bc-8d46-bea94d869dda', // BHEL Nagar
  '3ea08296-96b0-42b3-9071-b1552bdac11f', // Zamin Pallavaram
];
const AREAS_TO_MOVE = ['BHEL Nagar', 'Zamin Pallavaram', 'Malanganandapuram'];
const DUPLICATE_AREAS_TO_DELETE = ['Pallavaram', 'Latheef Colony'];

const dryRun = process.argv.includes('--dry-run');

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function referenceCount(areaId: string): Promise<number> {
  const counts = await Promise.all([
    prisma.listing.count({ where: { areaId } }),
    prisma.savedSearch.count({ where: { areaId } }),
    prisma.outreachContact.count({ where: { areaId } }),
    prisma.placesFetchLog.count({ where: { areaId } }),
    prisma.requirement.count({ where: { areaId } }),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}

async function main() {
  const [chennai, kanchipuram] = await Promise.all([
    prisma.city.findFirst({ where: { name: 'Chennai', source: 'curated' } }),
    prisma.city.findFirst({ where: { name: 'Kanchipuram', source: 'curated' } }),
  ]);
  if (!chennai || !kanchipuram) throw new Error('Chennai or Kanchipuram curated city not found — aborting.');
  const radius = chennai.catchmentKm > 0 ? chennai.catchmentKm : 25;
  console.log(`${dryRun ? '[dry run] ' : ''}Chennai catchment: ${radius} km`);

  // Areas first, so each listing's area is already under Chennai when the listing follows.
  for (const name of AREAS_TO_MOVE) {
    const area = await prisma.area.findFirst({ where: { name, cityId: kanchipuram.id } });
    if (!area) {
      console.log(`area "${name}": not under Kanchipuram — nothing to do`);
      continue;
    }
    const clash = await prisma.area.findFirst({ where: { name, cityId: chennai.id } });
    if (clash) {
      console.log(`area "${name}": SKIPPED — Chennai already has an area with that name`);
      continue;
    }
    console.log(`area "${name}": Kanchipuram -> Chennai`);
    if (!dryRun) await prisma.area.update({ where: { id: area.id }, data: { cityId: chennai.id } });
  }

  for (const id of LISTING_IDS) {
    const listing = await prisma.listing.findUnique({ where: { id }, include: { area: true } });
    if (!listing) {
      console.log(`listing ${id}: not found`);
      continue;
    }
    if (listing.cityId !== kanchipuram.id) {
      console.log(`listing ${id}: not under Kanchipuram any more — nothing to do`);
      continue;
    }
    if (listing.lat == null || listing.lng == null) {
      console.log(`listing ${id}: SKIPPED — no pin to verify against Chennai's catchment`);
      continue;
    }
    const distance = distanceKm(listing.lat, listing.lng, chennai.lat, chennai.lng);
    if (distance > radius) {
      console.log(`listing ${id}: SKIPPED — pin is ${distance.toFixed(1)} km from Chennai (catchment ${radius} km)`);
      continue;
    }
    // In a real run the area was moved above; in a dry run it hasn't been, so only check for real.
    if (!dryRun && listing.area && listing.area.cityId !== chennai.id) {
      console.log(`listing ${id}: SKIPPED — its area "${listing.area.name}" is not under Chennai`);
      continue;
    }
    console.log(`listing ${id} (${listing.title}): Kanchipuram -> Chennai (pin ${distance.toFixed(1)} km from centre)`);
    if (!dryRun) await prisma.listing.update({ where: { id }, data: { cityId: chennai.id } });
  }

  for (const name of DUPLICATE_AREAS_TO_DELETE) {
    const area = await prisma.area.findFirst({ where: { name, cityId: kanchipuram.id } });
    if (!area) {
      console.log(`duplicate area "${name}": not under Kanchipuram — nothing to do`);
      continue;
    }
    const twin = await prisma.area.findFirst({ where: { name, cityId: chennai.id } });
    const refs = await referenceCount(area.id);
    if (!twin || refs > 0) {
      console.log(`duplicate area "${name}": SKIPPED — ${twin ? '' : 'no Chennai twin; '}${refs} reference(s)`);
      continue;
    }
    console.log(`duplicate area "${name}": delete (unreferenced; Chennai already has its own)`);
    if (!dryRun) await prisma.area.delete({ where: { id: area.id } });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
