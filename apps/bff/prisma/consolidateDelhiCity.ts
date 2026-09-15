/**
 * One-off consolidation — see docs/plans/consolidate-delhi-city-google-matching.md for the full
 * investigation. Two "Delhi"-area City rows exist where only one should: a bad row named plain
 * "Delhi" (auto-created by some bulk import that only ever had building-level text to work with —
 * its Areas are all apartment/building names like "Block 12A", not real neighborhoods) and the
 * already-Google-matching "New Delhi" (what Google's own Geocoding API actually calls this
 * locality — confirmed empirically against several of the affected contacts' own coordinates).
 *
 * Also cleans up a "Metro" City this same investigation accidentally created while testing
 * reverse-geocode calls against unrelated coordinates — reverseGeocodeGoogle isn't read-only, it
 * creates rows as part of resolving a result, which wasn't obvious going in.
 *
 * Ids are hardcoded (confirmed against production via the public API immediately before this was
 * written) rather than looked up by name — deliberately, so a name collision elsewhere can never
 * make this touch the wrong row. Each one is asserted by name before anything is changed; this
 * throws immediately rather than silently mutating something unexpected if either id is stale.
 *
 * Run: pnpm --filter bff exec tsx prisma/consolidateDelhiCity.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BAD_DELHI_CITY_ID = 'cmtqwm9wr005h01p90uu9gqve';
const NEW_DELHI_CITY_ID = 'cmtmdwoex04zj01qm58c88e31';

async function assertCityName(id: string, expectedName: string): Promise<void> {
  const city = await prisma.city.findUniqueOrThrow({ where: { id } });
  if (city.name !== expectedName) {
    throw new Error(`Expected city ${id} to be named "${expectedName}", found "${city.name}" — aborting.`);
  }
}

async function assertCityEmpty(id: string): Promise<void> {
  const [listings, contacts, areas] = await Promise.all([
    prisma.listing.count({ where: { cityId: id } }),
    prisma.outreachContact.count({ where: { cityId: id } }),
    prisma.area.count({ where: { cityId: id } }),
  ]);
  if (listings > 0 || contacts > 0 || areas > 0) {
    throw new Error(
      `City ${id} still has ${listings} listings, ${contacts} contacts, ${areas} areas — refusing to delete.`,
    );
  }
}

async function main() {
  await assertCityName(BAD_DELHI_CITY_ID, 'Delhi');
  await assertCityName(NEW_DELHI_CITY_ID, 'New Delhi');

  // 1. Reparent every Area under the bad "Delhi" city to New Delhi — the 3 listings' areaId FKs
  // don't need to change, since the Area rows keep their own id/identity, just a different owner.
  const reparented = await prisma.area.updateMany({
    where: { cityId: BAD_DELHI_CITY_ID },
    data: { cityId: NEW_DELHI_CITY_ID },
  });
  console.log(`Reparented ${reparented.count} areas from "Delhi" to "New Delhi".`);

  // 2. Move the listings themselves.
  const movedListings = await prisma.listing.updateMany({
    where: { cityId: BAD_DELHI_CITY_ID },
    data: { cityId: NEW_DELHI_CITY_ID },
  });
  console.log(`Moved ${movedListings.count} listings from "Delhi" to "New Delhi".`);

  // 3. Re-resolve area for the contacts stuck on the bad "Delhi" city — accept New Delhi as a
  // valid target now that we've deliberately chosen it, in addition to the contact's own current
  // city (matches backfillMissingContactAreas.ts's original safety check, just widened by one id).
  const stuckContacts = await prisma.outreachContact.findMany({
    where: {
      cityId: BAD_DELHI_CITY_ID,
      areaId: null,
      lat: { not: null },
      lng: { not: null },
    },
    select: { id: true, name: true, lat: true, lng: true },
  });

  console.log(`\nRe-resolving area for ${stuckContacts.length} contacts still on "Delhi"...`);
  const bffBaseUrl = process.env.BFF_INTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

  for (const contact of stuckContacts) {
    try {
      const res = await fetch(`${bffBaseUrl}/locations/reverse-geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: contact.lat, lng: contact.lng }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const result: { cityId?: string; areaId?: string; cityName?: string } = await res.json();

      if (result.areaId && (result.cityId === NEW_DELHI_CITY_ID || result.cityId === BAD_DELHI_CITY_ID)) {
        await prisma.outreachContact.update({
          where: { id: contact.id },
          data: { cityId: NEW_DELHI_CITY_ID, areaId: result.areaId },
        });
        console.log(`  [fixed]   ${contact.name} (${contact.id}) — areaId ${result.areaId}`);
      } else {
        console.log(
          `  [skipped] ${contact.name} (${contact.id}) — resolved to "${result.cityName}" (${result.cityId}), not New Delhi — leave for manual review`,
        );
      }
    } catch (err) {
      console.error(`  [error]   ${contact.name} (${contact.id}) —`, err instanceof Error ? err.message : err);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // 4. Delete the now-empty bad "Delhi" city.
  await assertCityEmpty(BAD_DELHI_CITY_ID);
  await prisma.city.delete({ where: { id: BAD_DELHI_CITY_ID } });
  console.log(`\nDeleted the now-empty "Delhi" city (${BAD_DELHI_CITY_ID}).`);

  // 5. Clean up the accidental "Metro" city created while investigating this — look it up by
  // name rather than a hardcoded id, since it was never a deliberate row to begin with and there's
  // no risk of colliding with anything real.
  const metroCity = await prisma.city.findFirst({ where: { name: 'Metro' } });
  if (metroCity) {
    await prisma.area.deleteMany({ where: { cityId: metroCity.id } });
    await assertCityEmpty(metroCity.id);
    await prisma.city.delete({ where: { id: metroCity.id } });
    console.log(`Deleted the accidental "Metro" city (${metroCity.id}) and its areas.`);
  } else {
    console.log('No "Metro" city found — nothing to clean up there.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
