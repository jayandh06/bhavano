/**
 * One-off backfill: number-typed listing attributes stored as JSON strings become JSON numbers.
 *
 * Every client sends these as strings (the posting wizard's inputs are text, and the config's own
 * `defaultValue` for bedrooms is `"0"`), and nothing normalised them on the way in — so
 * `attributes.bedrooms` was `"2"` while `ListingsService.list()` filters on the number 2. The
 * result was that **every BHK filter and every /{n}bhk facet page returned nothing**, whichever
 * buckets were ticked. One row held `"02"`, which no string comparison would have matched either.
 *
 * `ListingsService.normalizeAttributes` fixes new writes; this fixes the rows already there.
 *
 * Idempotent: it only touches values that are still strings, and only those that are entirely
 * numeric — anything else is left exactly as it is and reported, since a value the config calls a
 * number but nobody can parse is a data question, not something a script should guess at.
 *
 * Run inside the bff container (it needs DATABASE_URL):
 *   docker compose -f docker-compose.prod.yml --env-file .env exec bff \
 *     npx tsx scripts/normalize-number-attributes.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CATEGORY_FIELD_CONFIG } from '@bhavano/types/categoryFields';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Every key any category declares as a number — deliberately derived from the config rather than
 * listed here, so a number field added later is covered by re-running this. */
function numberKeys(): string[] {
  const keys = new Set<string>();
  for (const fields of Object.values(CATEGORY_FIELD_CONFIG)) {
    for (const field of fields) if (field.type === 'number') keys.add(field.key);
  }
  return [...keys].sort();
}

/** Digits only, optionally signed/decimal, with surrounding space tolerated — "02" qualifies,
 * "2 BHK" does not. */
const NUMERIC_TEXT = '^\\s*-?\\d+(\\.\\d+)?\\s*$';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const keys = numberKeys();
  console.log(`${keys.length} number-typed keys: ${keys.join(', ')}`);
  console.log(dryRun ? 'DRY RUN — nothing will be written\n' : '');

  let converted = 0;
  let skipped = 0;

  for (const key of keys) {
    const [{ n: stringValued }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `select count(*)::bigint as n from "Listing" where jsonb_typeof(attributes->$1) = 'string'`,
      key,
    );
    if (stringValued === 0n) continue;

    const [{ n: parseable }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `select count(*)::bigint as n from "Listing"
         where jsonb_typeof(attributes->$1) = 'string' and attributes->>$1 ~ $2`,
      key,
      NUMERIC_TEXT,
    );
    const unparseable = Number(stringValued - parseable);
    if (unparseable > 0) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string }>>(
        `select id, attributes->>$1 as value from "Listing"
           where jsonb_typeof(attributes->$1) = 'string' and attributes->>$1 !~ $2 limit 5`,
        key,
        NUMERIC_TEXT,
      );
      console.log(
        `  ${key}: leaving ${unparseable} unparseable as-is, e.g. ${rows
          .map((r) => `${r.id}=${JSON.stringify(r.value)}`)
          .join(', ')}`,
      );
      skipped += unparseable;
    }

    if (dryRun) {
      console.log(`  ${key}: would convert ${parseable}`);
      converted += Number(parseable);
      continue;
    }

    const updated = await prisma.$executeRawUnsafe(
      `update "Listing"
          set attributes = jsonb_set(attributes, array[$1], to_jsonb((trim(attributes->>$1))::numeric))
        where jsonb_typeof(attributes->$1) = 'string' and attributes->>$1 ~ $2`,
      key,
      NUMERIC_TEXT,
    );
    console.log(`  ${key}: converted ${updated}`);
    converted += updated;
  }

  console.log(`\n${dryRun ? 'would convert' : 'converted'} ${converted}, left ${skipped} unparseable`);

  // Proof the thing this was for now works, in the same run: a numeric bedroom filter has to
  // match the rows it could never match before.
  const [{ n: numericBedrooms }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `select count(*)::bigint as n from "Listing" where jsonb_typeof(attributes->'bedrooms') = 'number'`,
  );
  const [{ n: stringBedrooms }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `select count(*)::bigint as n from "Listing" where jsonb_typeof(attributes->'bedrooms') = 'string'`,
  );
  console.log(`bedrooms now: ${numericBedrooms} numeric, ${stringBedrooms} still string`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
