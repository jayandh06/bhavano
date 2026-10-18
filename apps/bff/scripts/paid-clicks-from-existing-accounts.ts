/**
 * Read-only: how many Google Ads clicks came from people who already had a Bhavano account.
 *
 *   cd apps/bff && set -a && . ./.env && set +a && node_modules/.bin/tsx scripts/paid-clicks-from-existing-accounts.ts [days]
 *
 * Nothing is written. Counts `Visit` rows that carry a gclid (so they were paid clicks), are not
 * bots, and whose user signed up BEFORE that visit started. See
 * docs/plans/avoid-paid-clicks-from-existing-users.md.
 *
 * This is a LOWER BOUND: `Visit.userId` is only filled when the same session goes on to log in,
 * so a returning person who clicks an ad and never logs in during that sitting looks anonymous.
 * Output is aggregate counts and user ids only, no contact details.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const days = Number(process.argv[2] ?? 30);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface Row { campaignId: string | null; clicks: bigint; existing: bigint; people: bigint }

async function main() {
  const since = new Date(Date.now() - days * 86_400_000);

  const byCampaign = await prisma.$queryRaw<Row[]>`
    SELECT v."campaignId",
           COUNT(*)                                                                 AS clicks,
           COUNT(*) FILTER (WHERE u."createdAt" < v."createdAt")                    AS existing,
           COUNT(DISTINCT v."userId") FILTER (WHERE u."createdAt" < v."createdAt")  AS people
    FROM "Visit" v
    LEFT JOIN "User" u ON u.id = v."userId"
    WHERE v."gclid" IS NOT NULL AND v."isBot" IS NOT TRUE AND v."createdAt" >= ${since}
    GROUP BY v."campaignId"
    ORDER BY existing DESC, clicks DESC`;

  console.log(`Paid clicks in the last ${days} days, by campaign id (existing = signed up before the click)\n`);
  console.log('campaignId'.padEnd(16), 'clicks'.padStart(8), 'existing'.padStart(9), 'share'.padStart(7), 'people'.padStart(7));
  let total = 0n;
  let totalExisting = 0n;
  for (const r of byCampaign) {
    total += r.clicks;
    totalExisting += r.existing;
    const share = r.clicks ? ((Number(r.existing) / Number(r.clicks)) * 100).toFixed(1) + '%' : '-';
    console.log(String(r.campaignId ?? '(none)').padEnd(16), String(r.clicks).padStart(8), String(r.existing).padStart(9), share.padStart(7), String(r.people).padStart(7));
  }
  console.log(`\nTotal: ${total} paid clicks, ${totalExisting} from existing accounts (lower bound).`);

  const repeaters = await prisma.$queryRaw<{ userId: string; clicks: bigint; campaigns: bigint }[]>`
    SELECT v."userId", COUNT(*) AS clicks, COUNT(DISTINCT v."campaignId") AS campaigns
    FROM "Visit" v JOIN "User" u ON u.id = v."userId"
    WHERE v."gclid" IS NOT NULL AND v."isBot" IS NOT TRUE
      AND v."createdAt" >= ${since} AND u."createdAt" < v."createdAt"
    GROUP BY v."userId" HAVING COUNT(*) > 1
    ORDER BY clicks DESC LIMIT 15`;
  console.log('\nTop repeat clickers (user ids only):');
  for (const r of repeaters) console.log(' ', r.userId, `${r.clicks} clicks across ${r.campaigns} campaign(s)`);
}

main().finally(() => prisma.$disconnect());
