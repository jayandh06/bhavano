// One-off data fix, not a schema migration — `attributes` is JSONB, so the coworking category's
// `seatType` field switching from `select` (a plain string) to `multi-select` (a string[]) in
// categoryFields.ts needs no Prisma migration, but it does leave every existing coworking
// listing's stored attributes.seatType out of shape: still a bare string like "hot-desk" instead
// of ["hot-desk"]. Left alone, CategoryFieldInput's multi-select control treats a non-array value
// as an empty selection (`Array.isArray(value) ? value : []`), so opening an affected listing's
// edit form would show "Seat type" as unselected — and saving without re-selecting it would
// silently overwrite the real value with [], which would then fail assertValidAttributes'
// required-field check on the next save attempt. Same pattern as
// backfillSharingTypeMultiSelect.ts, which did this exact fix for PG's sharingType field.
//
// Idempotent: only rewrites rows where seatType is currently a plain non-empty string.
// Re-running after the first pass is a no-op (every row it would touch is already an array by
// then).
//
// Run: pnpm --filter @bhavano/bff backfill:seat-type-multiselect
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const candidates = await prisma.listing.findMany({
    where: { category: 'coworking' },
    select: { id: true, attributes: true },
  });

  let updated = 0;
  for (const listing of candidates) {
    const attributes = listing.attributes as Prisma.JsonObject;
    const seatType = attributes.seatType;
    if (typeof seatType !== 'string' || seatType === '') continue;

    await prisma.listing.update({
      where: { id: listing.id },
      data: { attributes: { ...attributes, seatType: [seatType] } },
    });
    updated++;
  }

  console.log(`Checked ${candidates.length} coworking listings — normalized seatType to an array on ${updated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
