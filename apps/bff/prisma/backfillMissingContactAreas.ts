/**
 * Retries area resolution for OutreachContact rows that have a cityId but no areaId (see
 * reportMissingContactAreas.ts for how these were found) — the exact condition that makes the
 * admin's "Create listing" action fail with "Either areaId or areaName is required". Reuses the
 * same public reverse-geocode endpoint the Google Places scraper already calls
 * (get_pg_coworking_leads.py's reverse_geocode()), over localhost since this runs inside the bff
 * container itself — no need to bootstrap Nest's DI graph for a one-off script.
 *
 * Safety rule, matching the scraper's own: only applies the resolved areaId when the geocoded
 * cityId matches the contact's EXISTING cityId. If Google resolves a different city entirely,
 * that's left alone rather than silently reassigning the contact to a city nobody chose — logged
 * as a mismatch for manual review instead.
 *
 * Real cost: each row is one Google Geocoding API call (same endpoint/pricing as everything else
 * already using GOOGLE_MAPS_SERVER_KEY) — fine at the ~21-contact scale this was written for,
 * worth reconsidering (batching/backoff) if this is ever re-run against a much larger backlog.
 *
 * Idempotent: only selects rows still missing areaId, so a re-run after a partial success (or a
 * crash) just picks up where it left off.
 *
 * Run: pnpm --filter bff exec tsx prisma/backfillMissingContactAreas.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BFF_BASE_URL = process.env.BFF_INTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const REQUEST_DELAY_MS = 300;

interface ReverseGeocodeResult {
  cityId?: string;
  areaId?: string;
  cityName?: string;
  resolvedLocality: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(`${BFF_BASE_URL}/locations/reverse-geocode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) throw new Error(`reverse-geocode failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const affected = await prisma.outreachContact.findMany({
    where: {
      businessCategory: { in: ['pg', 'coworking'] },
      cityId: { not: null },
      areaId: null,
      claimedListing: null,
      lat: { not: null },
      lng: { not: null },
    },
    select: { id: true, name: true, cityId: true, lat: true, lng: true },
  });

  console.log(`Retrying area resolution for ${affected.length} contacts...\n`);

  let fixed = 0;
  let cityMismatch = 0;
  let noAreaResolved = 0;

  for (const contact of affected) {
    try {
      const result = await reverseGeocode(contact.lat!, contact.lng!);

      if (!result.areaId) {
        console.log(`  [no area]     ${contact.name} (${contact.id}) — Google returned no locality for this point`);
        noAreaResolved++;
      } else if (result.cityId !== contact.cityId) {
        console.log(
          `  [city mismatch] ${contact.name} (${contact.id}) — resolved to "${result.cityName}" ` +
            `(${result.cityId}), contact is set to cityId ${contact.cityId} — left alone, review manually`,
        );
        cityMismatch++;
      } else {
        await prisma.outreachContact.update({
          where: { id: contact.id },
          data: { areaId: result.areaId },
        });
        console.log(`  [fixed]       ${contact.name} (${contact.id}) — areaId set to ${result.areaId}`);
        fixed++;
      }
    } catch (err) {
      console.error(`  [error]       ${contact.name} (${contact.id}) —`, err instanceof Error ? err.message : err);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nDone: ${fixed} fixed, ${cityMismatch} city mismatches (needs manual review), ${noAreaResolved} with no resolvable area.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
