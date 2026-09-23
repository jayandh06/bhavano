/**
 * Move every row off a user-submitted city onto a curated city, using coordinates, then delete
 * the auto-created city. A listing uses its own lat/lng, then its area's, then the stray city's
 * (the pin that created it). Inside a curated catchment, that city wins. Outside every catchment
 * the nearest curated city is used anyway — existing rows have no seller to ask, and the stray
 * city is still removed. New pins outside a catchment do not create a city; this script only
 * repairs rows that already exist.
 *
 * Run after the catchment resolver is deployed:
 *   pnpm --filter bff exec tsx prisma/reparentStrayCities.ts
 *
 * See docs/plans/canonical-city-catchment.md.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import { slugify } from '@bhavano/types/slugify';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Db = Prisma.TransactionClient;
type CityRow = { id: string; name: string; lat: number; lng: number; catchmentKm: number };

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function chooseParent(curated: CityRow[], lat: number, lng: number): { city: CityRow; distance: number; inside: boolean } {
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

async function repointArea(tx: Db, fromId: string, toId: string): Promise<void> {
  await tx.listing.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await tx.savedSearch.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await tx.requirement.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await tx.outreachContact.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  await tx.placesFetchLog.updateMany({ where: { areaId: fromId }, data: { areaId: toId } });
  const events = await tx.searchEvent.findMany({
    where: { areaIds: { has: fromId } },
    select: { id: true, areaIds: true },
  });
  for (const event of events) {
    await tx.searchEvent.update({
      where: { id: event.id },
      data: { areaIds: [...new Set(event.areaIds.map((id) => (id === fromId ? toId : id)))] },
    });
  }
}

async function areaOnCity(
  tx: Db,
  parentId: string,
  name: string,
  lat: number | null,
  lng: number | null,
): Promise<string> {
  const existing = await tx.area.findFirst({
    where: { cityId: parentId, name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const created = await tx.area.create({
    data: { name: name.trim(), cityId: parentId, lat, lng, source: 'user-submitted' },
  });
  return created.id;
}

async function main() {
  const curated = await prisma.city.findMany({
    where: { source: 'curated' },
    select: { id: true, name: true, lat: true, lng: true, catchmentKm: true },
  });
  if (curated.length === 0) throw new Error('No curated cities — nothing to reparent onto.');
  const curatedSlugs = new Set(curated.map((city) => slugify(city.name)));

  const strays = await prisma.city.findMany({ where: { source: 'user-submitted' } });
  console.log(`Found ${strays.length} user-submitted ${strays.length === 1 ? 'city' : 'cities'}.`);

  for (const stray of strays) {
    const counts = new Map<string, number>();
    await prisma.$transaction(async (tx) => {
      const listings = await tx.listing.findMany({
        where: { cityId: stray.id },
        include: { area: true },
      });

      for (const listing of listings) {
        const lat = listing.lat ?? listing.area.lat ?? stray.lat;
        const lng = listing.lng ?? listing.area.lng ?? stray.lng;
        const parent = chooseParent(curated, lat, lng);
        counts.set(parent.city.id, (counts.get(parent.city.id) ?? 0) + 1);
        if (!parent.inside) {
          console.log(
            `OUTSIDE catchment: listing ${listing.id} (${lat}, ${lng}) -> ${parent.city.name} (${parent.distance.toFixed(1)} km)`,
          );
        }
        const areaId = await areaOnCity(tx, parent.city.id, listing.area.name, listing.area.lat, listing.area.lng);
        await tx.listing.update({ where: { id: listing.id }, data: { cityId: parent.city.id, areaId } });
      }

      const leftoverAreas = await tx.area.findMany({ where: { cityId: stray.id } });
      for (const area of leftoverAreas) {
        const parent = chooseParent(curated, area.lat ?? stray.lat, area.lng ?? stray.lng);
        if (!parent.inside) {
          console.log(
            `OUTSIDE catchment: area "${area.name}" -> ${parent.city.name} (${parent.distance.toFixed(1)} km)`,
          );
        }
        const existing = await tx.area.findFirst({
          where: { cityId: parent.city.id, name: { equals: area.name, mode: 'insensitive' } },
        });
        if (existing && existing.id !== area.id) {
          await repointArea(tx, area.id, existing.id);
          await tx.area.delete({ where: { id: area.id } });
        } else if (area.cityId !== parent.city.id) {
          await tx.area.update({ where: { id: area.id }, data: { cityId: parent.city.id } });
        }
      }

      const centroid = chooseParent(curated, stray.lat, stray.lng);
      if (!centroid.inside) {
        console.log(
          `OUTSIDE catchment: city "${stray.name}" centroid -> ${centroid.city.name} (${centroid.distance.toFixed(1)} km)`,
        );
      }
      const cityId = centroid.city.id;
      await tx.user.updateMany({ where: { cityId: stray.id }, data: { cityId } });
      await tx.savedSearch.updateMany({ where: { cityId: stray.id }, data: { cityId } });
      await tx.requirement.updateMany({ where: { cityId: stray.id }, data: { cityId } });
      await tx.searchEvent.updateMany({ where: { cityId: stray.id }, data: { cityId } });
      await tx.placesFetchLog.updateMany({ where: { cityId: stray.id }, data: { cityId } });
      await tx.localityAlias.updateMany({ where: { cityId: stray.id }, data: { cityId } });

      const contacts = await tx.outreachContact.findMany({
        where: { cityId: stray.id },
        select: { id: true, lat: true, lng: true },
      });
      for (const contact of contacts) {
        const parent =
          contact.lat != null && contact.lng != null ? chooseParent(curated, contact.lat, contact.lng) : centroid;
        await tx.outreachContact.update({ where: { id: contact.id }, data: { cityId: parent.city.id } });
      }

      const still = await Promise.all([
        tx.listing.count({ where: { cityId: stray.id } }),
        tx.area.count({ where: { cityId: stray.id } }),
        tx.user.count({ where: { cityId: stray.id } }),
        tx.savedSearch.count({ where: { cityId: stray.id } }),
        tx.requirement.count({ where: { cityId: stray.id } }),
        tx.searchEvent.count({ where: { cityId: stray.id } }),
        tx.outreachContact.count({ where: { cityId: stray.id } }),
        tx.placesFetchLog.count({ where: { cityId: stray.id } }),
        tx.localityAlias.count({ where: { cityId: stray.id } }),
      ]);
      if (still.some((count) => count > 0)) {
        throw new Error(`"${stray.name}" still has references (${still.join(', ')}); not deleting.`);
      }

      let dominant = centroid.city;
      let best = -1;
      for (const [id, count] of counts) {
        if (count > best) {
          best = count;
          dominant = curated.find((city) => city.id === id) ?? centroid.city;
        }
      }
      const slug = slugify(stray.name);
      if (slug && !curatedSlugs.has(slug)) {
        await tx.citySlugRedirect.upsert({
          where: { slug },
          update: { cityId: dominant.id },
          create: { slug, cityId: dominant.id },
        });
        console.log(`Redirect /${slug} -> ${dominant.name}`);
      }

      await tx.city.delete({ where: { id: stray.id } });
      console.log(`Deleted user-submitted city "${stray.name}" (${listings.length} listings moved).`);
    });
  }

  const remaining = await prisma.city.count({ where: { source: 'user-submitted' } });
  console.log(`User-submitted cities remaining: ${remaining}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
