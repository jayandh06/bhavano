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

/**
 * "New Delhi" already has areas of its own from real map-picker usage — including several
 * generic building-block names ("Block A", "Block D", "Block H", "Block KD") that collide
 * exactly with same-named areas under the bad "Delhi" city. A blind bulk rename hits the
 * (name, cityId) unique constraint on the first such collision (confirmed: that's exactly what
 * happened on the first run of this script). Handle each area individually instead: no
 * collision -> simple reparent, keeping the same area id; collision -> repoint every table that
 * references the old area (Listing, OutreachContact, SavedSearch, PlacesFetchLog) onto the
 * already-existing New Delhi area with that name, then delete the now-unreferenced duplicate.
 */
async function mergeOrReparentArea(oldArea: { id: string; name: string }): Promise<void> {
  const existing = await prisma.area.findFirst({
    where: { cityId: NEW_DELHI_CITY_ID, name: { equals: oldArea.name, mode: 'insensitive' } },
  });

  if (!existing) {
    await prisma.area.update({ where: { id: oldArea.id }, data: { cityId: NEW_DELHI_CITY_ID } });
    console.log(`  [reparented] "${oldArea.name}"`);
    return;
  }

  await prisma.listing.updateMany({ where: { areaId: oldArea.id }, data: { areaId: existing.id } });
  await prisma.outreachContact.updateMany({ where: { areaId: oldArea.id }, data: { areaId: existing.id } });
  await prisma.savedSearch.updateMany({ where: { areaId: oldArea.id }, data: { areaId: existing.id } });
  await prisma.placesFetchLog.updateMany({ where: { areaId: oldArea.id }, data: { areaId: existing.id } });
  await prisma.area.delete({ where: { id: oldArea.id } });
  console.log(`  [merged]     "${oldArea.name}" -> existing New Delhi area ${existing.id}`);
}

async function main() {
  await assertCityName(BAD_DELHI_CITY_ID, 'Delhi');
  await assertCityName(NEW_DELHI_CITY_ID, 'New Delhi');

  // 1. Reparent (or merge, on a name collision) every Area under the bad "Delhi" city.
  const delhiAreas = await prisma.area.findMany({ where: { cityId: BAD_DELHI_CITY_ID } });
  console.log(`Reparenting/merging ${delhiAreas.length} areas from "Delhi" to "New Delhi"...`);
  for (const area of delhiAreas) {
    await mergeOrReparentArea(area);
  }

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

  // 3b. Catch-all: contacts that already had a usable areaId (so step 3's `areaId: null` filter
  // never touched them) can still have cityId pointing at the bad "Delhi" row independently of
  // their area — cityId isn't derived from areaId, it's just another plain field on the same
  // row. No collision risk updating it in bulk (unlike Area, OutreachContact has no unique
  // constraint involving cityId).
  const remainingContacts = await prisma.outreachContact.updateMany({
    where: { cityId: BAD_DELHI_CITY_ID },
    data: { cityId: NEW_DELHI_CITY_ID },
  });
  console.log(`\nReassigned ${remainingContacts.count} more contacts' cityId (already had a usable area).`);

  // 4. Delete the now-empty bad "Delhi" city.
  await assertCityEmpty(BAD_DELHI_CITY_ID);
  await prisma.city.delete({ where: { id: BAD_DELHI_CITY_ID } });
  console.log(`\nDeleted the now-empty "Delhi" city (${BAD_DELHI_CITY_ID}).`);

  // 5. Clean up the accidental "Metro" city created while investigating this — look it up by
  // name rather than a hardcoded id, since it was never a deliberate row to begin with. Still
  // checked for real references before deleting anything, same "fail loud, don't assume" rule
  // as everywhere else here, even though this is expected to be pure test noise.
  const metroCity = await prisma.city.findFirst({ where: { name: 'Metro' } });
  if (metroCity) {
    const metroAreas = await prisma.area.findMany({ where: { cityId: metroCity.id } });
    for (const area of metroAreas) {
      const [listings, contacts, savedSearches, placesFetchLogs] = await Promise.all([
        prisma.listing.count({ where: { areaId: area.id } }),
        prisma.outreachContact.count({ where: { areaId: area.id } }),
        prisma.savedSearch.count({ where: { areaId: area.id } }),
        prisma.placesFetchLog.count({ where: { areaId: area.id } }),
      ]);
      if (listings + contacts + savedSearches + placesFetchLogs > 0) {
        throw new Error(`Area "${area.name}" under "Metro" is still referenced — refusing to delete.`);
      }
    }
    await prisma.area.deleteMany({ where: { cityId: metroCity.id } });
    await assertCityEmpty(metroCity.id);
    await prisma.city.delete({ where: { id: metroCity.id } });
    console.log(`Deleted the accidental "Metro" city (${metroCity.id}) and its ${metroAreas.length} area(s).`);
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
