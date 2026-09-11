// One-off data fix, not a schema migration — `attributes` is JSONB, so the pg category's
// `gender` field ("Preferred for") switching from `select` (a plain string) to `multi-select`
// (a string[]) in categoryFields.ts needs no Prisma migration, but it does leave every existing
// pg listing's stored attributes.gender out of shape: still a bare string like "men" instead of
// ["men"]. Left alone, CategoryFieldInput's multi-select control treats a non-array value as an
// empty selection (`Array.isArray(value) ? value : []`), so opening an affected listing's edit
// form would show "Preferred for" as unselected — and saving without re-touching it would
// silently overwrite the real value with []. The read-only listing detail page already handles
// both shapes fine (formatAttributeValue falls back to String(value) for a non-array), so this
// is purely about protecting the edit path.
//
// Idempotent: only rewrites rows where gender is currently a plain non-empty string. Re-running
// after the first pass is a no-op (every row it would touch is already an array by then).
//
// Run: pnpm --filter @bhavano/bff prisma:migrate:gender-multiselect
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const candidates = await prisma.listing.findMany({
    where: { category: 'pg' },
    select: { id: true, attributes: true },
  });

  let updated = 0;
  for (const listing of candidates) {
    const attributes = listing.attributes as Prisma.JsonObject;
    const gender = attributes.gender;
    if (typeof gender !== 'string' || gender === '') continue;

    await prisma.listing.update({
      where: { id: listing.id },
      data: { attributes: { ...attributes, gender: [gender] } },
    });
    updated++;
  }

  console.log(`Checked ${candidates.length} pg listings — normalized gender to an array on ${updated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
