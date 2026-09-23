/**
 * Move listings, areas, and outreach contacts onto a curated city that now exists, when
 * the pin is outside the city it was filed under and inside a different city's catchment.
 * A pin still inside its current city stays there, so south Bengaluru (Sarjapura,
 * Chandapura) is not pulled onto Hosur just because Hosur's circle overlaps. A pin
 * outside every catchment stays on its current city. Rows with no coordinates stay put.
 *
 * Dry run (default):
 *   npx tsx prisma/remapToKnownCities.ts
 * Apply:
 *   REMAP_APPLY=1 npx tsx prisma/remapToKnownCities.ts
 *
 * See docs/plans/canonical-city-catchment.md.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const apply = process.env.REMAP_APPLY === '1';

type Db = Prisma.TransactionClient | PrismaClient;
type CityRow = { id: string; name: string; lat: number; lng: number; catchmentKm: number };

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

function chooseParent(
  curated: CityRow[],
  lat: number,
  lng: number,
): { city: CityRow; distance: number; inside: boolean } {
  let nearest = curated[0];
  let nearestDist = Infinity;
  let inside: CityRow | null = null;
  let insideDist = Infinity;
  for (const city of curated) {
    const distance = distanceKm(lat, lng, city.lat, city.lng);
    if (distance < nearestDist) {
      nearest = city;
      nearestDist = distance;
    }
    const radius = city.catchmentKm > 0 ? city.catchmentKm : 25;
    if (distance <= radius && distance < insideDist) {
      inside = city;
      insideDist = distance;
    }
  }
  return inside
    ? { city: inside, distance: insideDist, inside: true }
    : { city: nearest, distance: nearestDist, inside: false };
}

/** Null when the row should stay: still inside its current catchment, or not inside any other. */
function destination(
  curated: CityRow[],
  current: CityRow | undefined,
  lat: number,
  lng: number,
): { city: CityRow; distance: number } | null {
  if (!current) return null;
  const radius = current.catchmentKm > 0 ? current.catchmentKm : 25;
  if (distanceKm(lat, lng, current.lat, current.lng) <= radius) return null;
  const parent = chooseParent(curated, lat, lng);
  if (!parent.inside || parent.city.id === current.id) return null;
  return { city: parent.city, distance: parent.distance };
}

function bump(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

async function areaOnCity(
  db: Db,
  parentId: string,
  name: string,
  lat: number | null,
  lng: number | null,
): Promise<string> {
  const existing = await db.area.findFirst({
    where: { cityId: parentId, name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  if (!apply) return `dry-${parentId}-${name}`;
  const created = await db.area.create({
    data: { name: name.trim(), cityId: parentId, lat, lng, source: 'user-submitted' },
  });
  return created.id;
}

async function repointArea(db: Db, fromId: string, toId: string): Promise<void> {
  await db.listing.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await db.savedSearch.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await db.requirement.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await db.outreachContact.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await db.placesFetchLog.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  const events = await db.searchEvent.findMany({
    where: { areaIds: { has: fromId } },
    select: { id: true, areaIds: true },
  });
  for (const event of events) {
    await db.searchEvent.update({
      where: { id: event.id },
      data: { areaIds: [...new Set(event.areaIds.map((id) => (id === fromId ? toId : id)))] },
    });
  }
}

async function retargetCity(db: Db, areaId: string, fromCityId: string, toCityId: string): Promise<void> {
  await db.savedSearch.updateMany({ where: { areaId, cityId: fromCityId }, data: { cityId: toCityId } });
  await db.requirement.updateMany({ where: { areaId, cityId: fromCityId }, data: { cityId: toCityId } });
  await db.outreachContact.updateMany({ where: { areaId, cityId: fromCityId }, data: { cityId: toCityId } });
  await db.placesFetchLog.updateMany({ where: { areaId, cityId: fromCityId }, data: { cityId: toCityId } });
  await db.searchEvent.updateMany({ where: { cityId: fromCityId, areaIds: { has: areaId } }, data: { cityId: toCityId } });
}

async function main() {
  const curated = await prisma.city.findMany({
    where: { source: 'curated' },
    select: { id: true, name: true, lat: true, lng: true, catchmentKm: true },
  });
  if (curated.length === 0) throw new Error('No curated cities.');
  const byId = new Map(curated.map((city) => [city.id, city]));
  console.log(`${apply ? 'Applying' : 'Dry run'}: ${curated.length} curated cities.`);

  const listingMoves = new Map<string, number>();
  let listingsSkipped = 0;
  let listingsKept = 0;
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      cityId: true,
      lat: true,
      lng: true,
      area: { select: { name: true, lat: true, lng: true } },
    },
  });

  for (const listing of listings) {
    const lat = listing.lat ?? listing.area.lat;
    const lng = listing.lng ?? listing.area.lng;
    if (lat == null || lng == null) {
      listingsSkipped += 1;
      continue;
    }
    const parent = destination(curated, byId.get(listing.cityId), lat, lng);
    if (!parent) {
      listingsKept += 1;
      continue;
    }
    const from = byId.get(listing.cityId)?.name ?? listing.cityId;
    bump(listingMoves, `${from} -> ${parent.city.name}`);
    console.log(
      `listing ${listing.id} (${lat.toFixed(4)}, ${lng.toFixed(4)}) ${from} -> ${parent.city.name} (${parent.distance.toFixed(1)} km) area ${listing.area.name}`,
    );
    if (!apply) continue;
    const areaId = await areaOnCity(prisma, parent.city.id, listing.area.name, listing.area.lat, listing.area.lng);
    await prisma.listing.update({ where: { id: listing.id }, data: { cityId: parent.city.id, areaId } });
  }

  const areaMoves = new Map<string, number>();
  let areasKept = 0;
  let areasBlocked = 0;
  const areas = await prisma.area.findMany({
    select: { id: true, name: true, cityId: true, lat: true, lng: true },
  });
  for (const area of areas) {
    if (area.lat == null || area.lng == null) continue;
    const parent = destination(curated, byId.get(area.cityId), area.lat, area.lng);
    if (!parent) {
      areasKept += 1;
      continue;
    }
    const staying = await prisma.listing.count({ where: { areaId: area.id, cityId: area.cityId } });
    const from = byId.get(area.cityId)?.name ?? area.cityId;
    if (staying > 0) {
      areasBlocked += 1;
      console.log(
        `Area "${area.name}" coords -> ${parent.city.name} but ${staying} listing(s) stay on ${from}; area left in place.`,
      );
      continue;
    }
    bump(areaMoves, `${from} -> ${parent.city.name}`);
    if (!apply) continue;
    await retargetCity(prisma, area.id, area.cityId, parent.city.id);
    const existing = await prisma.area.findFirst({
      where: { cityId: parent.city.id, name: { equals: area.name, mode: 'insensitive' } },
    });
    if (existing && existing.id !== area.id) {
      await repointArea(prisma, area.id, existing.id);
      await prisma.area.delete({ where: { id: area.id } });
    } else {
      await prisma.area.update({ where: { id: area.id }, data: { cityId: parent.city.id } });
    }
  }

  const contactMoves = new Map<string, number>();
  let contactsKept = 0;
  let contactsSkipped = 0;
  const contacts = await prisma.outreachContact.findMany({
    where: { lat: { not: null }, lng: { not: null }, cityId: { not: null } },
    select: { id: true, cityId: true, lat: true, lng: true, areaId: true, area: { select: { name: true, lat: true, lng: true } } },
  });
  for (const contact of contacts) {
    if (contact.lat == null || contact.lng == null || contact.cityId == null) {
      contactsSkipped += 1;
      continue;
    }
    const parent = destination(curated, byId.get(contact.cityId), contact.lat, contact.lng);
    if (!parent) {
      contactsKept += 1;
      continue;
    }
    const from = byId.get(contact.cityId)?.name ?? contact.cityId;
    bump(contactMoves, `${from} -> ${parent.city.name}`);
    if (!apply) continue;
    const areaId = contact.area
      ? await areaOnCity(prisma, parent.city.id, contact.area.name, contact.area.lat, contact.area.lng)
      : null;
    await prisma.outreachContact.update({
      where: { id: contact.id },
      data: { cityId: parent.city.id, ...(areaId ? { areaId } : {}) },
    });
  }

  const redirects = await prisma.citySlugRedirect.findMany({
    select: { slug: true, city: { select: { name: true } } },
  });
  const liveSlugs = new Set(curated.map((city) => slugify(city.name)));
  const droppedRedirects: string[] = [];
  for (const redirect of redirects) {
    if (!liveSlugs.has(redirect.slug)) continue;
    droppedRedirects.push(`/${redirect.slug} (was ${redirect.city.name})`);
    if (apply) await prisma.citySlugRedirect.delete({ where: { slug: redirect.slug } });
  }

  function printMoves(label: string, moves: Map<string, number>) {
    const rows = [...moves.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const total = rows.reduce((sum, [, count]) => sum + count, 0);
    console.log(`\n${label}: ${total}`);
    for (const [key, count] of rows) console.log(`  ${count}\t${key}`);
  }

  printMoves('Listings to move', listingMoves);
  console.log(`Listings left in place: ${listingsKept}. Listings with no coordinates: ${listingsSkipped}.`);
  printMoves('Areas to move', areaMoves);
  console.log(`Areas left in place: ${areasKept}. Areas left because listings stay: ${areasBlocked}.`);
  printMoves('Outreach contacts to move', contactMoves);
  console.log(`Outreach contacts left in place: ${contactsKept}. Skipped: ${contactsSkipped}.`);
  console.log(`\nSlug redirects cleared because that city now exists: ${droppedRedirects.length}`);
  for (const line of droppedRedirects) console.log(`  ${line}`);
  console.log(apply ? '\nRemap applied.' : '\nDry run only. Re-run with REMAP_APPLY=1 to write.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
