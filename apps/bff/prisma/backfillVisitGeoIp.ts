// Backfills `ipCity`/`ipRegion`/`ipCountry` on existing Visit rows — see
// docs/plans/visit-ip-city-logging.md. AnalyticsService.recordVisit() only ever does this lookup
// for *new* visits going forward, so every row written before GEOIP_DB_PATH was configured (or
// before this feature existed at all) is stuck with those three columns null until this runs
// once against production.
//
// Run standalone: `pnpm --filter @bhavano/bff backfill:visit-geoip` (wired to
// `tsx prisma/backfillVisitGeoIp.ts`). Needs DATABASE_URL and GEOIP_DB_PATH in the environment —
// on the app host, that means running it with .env loaded, e.g.:
//   docker compose -f docker-compose.prod.yml exec -T bff sh -c \
//     "cd /app/apps/bff && npx tsx prisma/backfillVisitGeoIp.ts"
// (the container already has GEOIP_DB_PATH and DATABASE_URL set, and the mmdb bind-mounted).
//
// Safe to re-run: it only ever touches rows where all three columns are still null, so a partial
// run (killed midway, or run again after a fresher .mmdb is installed) just picks up where it
// left off rather than redoing already-backfilled rows. A row whose IP had no match in the
// database stays null and gets retried on every run — cheap, and the answer may change once the
// database is next refreshed.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { open, type CityResponse } from 'maxmind';

const BATCH_SIZE = 500;

async function backfillVisitGeoIp(prisma: PrismaClient): Promise<void> {
  const dbPath = process.env.GEOIP_DB_PATH;
  if (!dbPath) {
    throw new Error(
      'GEOIP_DB_PATH is not set — nothing to look up IPs against. Set it in .env first.',
    );
  }
  if (!existsSync(dbPath)) {
    throw new Error(
      `GEOIP_DB_PATH points at ${dbPath}, which does not exist. Run scripts/update-geolite.sh first.`,
    );
  }
  const reader = await open<CityResponse>(dbPath);

  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let noMatch = 0;

  for (;;) {
    const rows = await prisma.visit.findMany({
      where: {
        ip: { not: null },
        ipCity: null,
        ipRegion: null,
        ipCountry: null,
      },
      select: { id: true, ip: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      let found: CityResponse | null = null;
      try {
        found = row.ip ? reader.get(row.ip) : null;
      } catch {
        // Not a valid address (e.g. a junk X-Forwarded-For recorded before validation tightened).
        found = null;
      }
      const city = found?.city?.names?.en ?? null;
      const region = found?.subdivisions?.[0]?.names?.en ?? null;
      const country = found?.country?.names?.en ?? null;
      if (!city && !region && !country) {
        noMatch++;
        continue;
      }
      await prisma.visit.update({
        where: { id: row.id },
        data: { ipCity: city, ipRegion: region, ipCountry: country },
      });
      updated++;
    }

    cursor = rows[rows.length - 1].id;
    console.log(`…scanned ${scanned}, updated ${updated}, no match ${noMatch}`);
  }

  console.log(
    `Done. Scanned ${scanned} visit(s), updated ${updated}, no GeoIP match for ${noMatch}.`,
  );
}

if (require.main === module) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  backfillVisitGeoIp(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
