/**
 * Read-only diagnostic — no writes, no external API calls. Reports how many pg/coworking
 * OutreachContact rows are missing an areaId (the exact condition that makes the admin's
 * "Create listing" action fail with "Either areaId or areaName is required" —
 * see OutreachService.createListingFromContact / LocationsService.ensureArea), scoped to
 * contacts that don't already have a claimed listing (the ones actually still blocking real
 * work). Segments by whether lat/lng is present, since only those are candidates for a
 * reverse-geocode retry fix — a contact with no lat/lng can only ever be fixed by a human
 * typing in an area (the export/bulk_upload_listings.py CSV path).
 *
 * Run: pnpm --filter bff exec tsx prisma/reportMissingContactAreas.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const affected = await prisma.outreachContact.findMany({
    where: {
      businessCategory: { in: ['pg', 'coworking'] },
      cityId: { not: null },
      areaId: null,
      claimedListing: null,
    },
    select: { id: true, name: true, cityId: true, lat: true, lng: true },
  });

  const withCoords = affected.filter((c) => c.lat != null && c.lng != null);
  const withoutCoords = affected.filter((c) => c.lat == null || c.lng == null);

  const byCity = new Map<string, number>();
  for (const c of affected) byCity.set(c.cityId!, (byCity.get(c.cityId!) ?? 0) + 1);

  console.log(`Total affected (cityId set, areaId null, not yet claimed): ${affected.length}`);
  console.log(`  - with lat/lng (reverse-geocode retry candidates): ${withCoords.length}`);
  console.log(`  - without lat/lng (need a human-entered area regardless): ${withoutCoords.length}`);
  console.log(`\nBy cityId:`);
  for (const [cityId, count] of byCity) console.log(`  ${cityId}: ${count}`);

  if (withoutCoords.length > 0) {
    console.log(`\nFirst 10 without lat/lng:`);
    for (const c of withoutCoords.slice(0, 10)) console.log(`  ${c.name} (${c.id})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
