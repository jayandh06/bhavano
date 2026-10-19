/**
 * Writes contact details of existing users to stdout as CSV (email,phone) for
 * ads_customer_match_upload.py, so they can be excluded from acquisition campaigns.
 *
 * THIS IS PERSONAL DATA. Redirect it to a file OUTSIDE the repo, upload it, then delete it:
 *
 *   cd apps/bff && set -a && . ./.env && set +a && \
 *     node_modules/.bin/tsx scripts/export-customer-match.ts [all|posters] > ~/customer-match.csv
 *
 * `posters` = users who own at least one listing (the people the poster campaigns want to skip).
 * `all` = every user with an email or phone. Raw values are written; the Python script normalises
 * and hashes them on this machine before anything is sent. Nothing here is sent anywhere.
 *
 * Do not run this until /privacy says that hashed contact details are shared with Google to
 * exclude existing users from ads, and the business has decided it has the right to do so. See
 * docs/plans/avoid-paid-clicks-from-existing-users.md.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const scope = process.argv[2] === 'posters' ? 'posters' : 'all';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const csv = (value: string | null) => (value ? `"${value.replace(/"/g, '""')}"` : '');

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ email: { not: null } }, { phone: { not: null } }],
      ...(scope === 'posters' ? { listings: { some: {} } } : {}),
    },
    select: { email: true, phone: true },
  });
  console.log('email,phone');
  for (const user of users) console.log(`${csv(user.email)},${csv(user.phone)}`);
  console.error(`Exported ${users.length} users (${scope}). Delete the file after the upload.`);
}

main().finally(() => prisma.$disconnect());
