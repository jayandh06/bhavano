/**
 * Recomputes the segment values behind `src/ads/post-ad-value.ts` from real Listing/Payment
 * data, for a human to review before copying any changed numbers into that file by hand.
 *
 * Deliberately not automatic — see post-ad-value.ts's own doc comment: this account's purchase
 * volume is still small enough (41 paid payments as of 2026-10-08) that an unattended refresh
 * would just chase noise from one month to the next. Re-run this by hand once there's meaningfully
 * more data (the ~30/month trust threshold already used elsewhere in this account's bidding
 * decisions — see docs/plans/target-roas-value-carrying-campaigns.md — is the right bar), read the
 * printed latency/poster/payer numbers before trusting the output, and only then update
 * post-ad-value.ts's three tables.
 *
 * Read-only — does not write anything. Self-serve posts only: `source IN (direct, google_api)`,
 * `createdByAdminId` null, same filter the original 2026-10-08 analysis used, so a re-run is
 * comparing like with like.
 *
 * Run inside the bff container (needs DATABASE_URL):
 *   docker compose -f docker-compose.prod.yml --env-file .env exec bff \
 *     npx tsx scripts/regenerate-post-ad-value.ts [--window-days=7] [--min-posters=10]
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function arg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? Number(found.slice(prefix.length)) : fallback;
}

const WINDOW_DAYS = arg('window-days', 7);
const MIN_POSTERS = arg('min-posters', 10);

function pct(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(p * (sorted.length - 1))];
}

type FirstPost = { ownerId: string; category: string; transactionType: string; createdAt: Date };

function aggregate(
  firstPostByUser: Map<string, FirstPost>,
  paymentsByUser: Map<string, { amount: number; paidAt: Date | null }[]>,
  keyFn: (f: FirstPost) => string,
) {
  const segments = new Map<string, { posters: Set<string>; payers: Set<string>; revenue: number }>();
  for (const [userId, first] of firstPostByUser) {
    const key = keyFn(first);
    const s = segments.get(key) ?? { posters: new Set(), payers: new Set(), revenue: 0 };
    s.posters.add(userId);
    for (const p of paymentsByUser.get(userId) ?? []) {
      if (!p.paidAt) continue;
      const days = (p.paidAt.getTime() - first.createdAt.getTime()) / 86_400_000;
      if (days >= 0 && days <= WINDOW_DAYS) {
        s.revenue += p.amount;
        s.payers.add(userId);
      }
    }
    segments.set(key, s);
  }
  return segments;
}

function printTable(segments: Map<string, { posters: Set<string>; payers: Set<string>; revenue: number }>) {
  const rows = [...segments.entries()]
    .map(([key, s]) => ({ key, posters: s.posters.size, payers: s.payers.size, revenue: s.revenue, value: s.revenue / s.posters.size }))
    .sort((a, b) => b.value - a.value);
  console.log('segment'.padEnd(30), 'posters'.padStart(7), 'payers'.padStart(7), 'revenue'.padStart(9), 'value/poster'.padStart(12));
  for (const r of rows) {
    console.log(
      r.key.padEnd(30), String(r.posters).padStart(7), String(r.payers).padStart(7),
      String(r.revenue).padStart(9), r.value.toFixed(1).padStart(12),
      r.posters < MIN_POSTERS ? '  (thin — do not use directly)' : '',
    );
  }
  return rows;
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { source: { in: ['direct', 'google_api'] }, createdByAdminId: null },
    select: { ownerId: true, category: true, transactionType: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const firstPostByUser = new Map<string, FirstPost>();
  for (const l of listings) if (!firstPostByUser.has(l.ownerId)) firstPostByUser.set(l.ownerId, l);
  console.log(`Self-serve posters: ${firstPostByUser.size}  |  window: ${WINDOW_DAYS}d  |  min posters to trust a segment: ${MIN_POSTERS}\n`);

  const userIds = [...firstPostByUser.keys()];
  const payments = await prisma.payment.findMany({
    where: { userId: { in: userIds }, status: 'paid' },
    select: { userId: true, amount: true, paidAt: true },
  });
  const paymentsByUser = new Map<string, { amount: number; paidAt: Date | null }[]>();
  for (const p of payments) {
    const arr = paymentsByUser.get(p.userId) ?? [];
    arr.push(p);
    paymentsByUser.set(p.userId, arr);
  }

  // Latency sanity check — if this drifts far from "most payments land within a week", the
  // WINDOW_DAYS assumption baked into post-ad-value.ts's doc comment needs revisiting too, not
  // just the numbers.
  const latencies: number[] = [];
  for (const [userId, first] of firstPostByUser) {
    for (const p of paymentsByUser.get(userId) ?? []) {
      if (!p.paidAt) continue;
      const days = (p.paidAt.getTime() - first.createdAt.getTime()) / 86_400_000;
      if (days >= 0) latencies.push(days);
    }
  }
  if (latencies.length) {
    const within = latencies.filter((d) => d <= WINDOW_DAYS).length;
    console.log(
      `Post -> payment latency: median ${pct(latencies, 0.5).toFixed(1)}d, p90 ${pct(latencies, 0.9).toFixed(1)}d, ` +
        `${within}/${latencies.length} (${(100 * within / latencies.length).toFixed(0)}%) within the ${WINDOW_DAYS}d window\n`,
    );
  }

  console.log(`=== category x transactionType (segment table — the PRIMARY lookup in post-ad-value.ts) ===`);
  printTable(aggregate(firstPostByUser, paymentsByUser, (f) => `${f.category}|${f.transactionType}`));

  console.log(`\n=== category alone (fallback when the segment above is thin) ===`);
  printTable(aggregate(firstPostByUser, paymentsByUser, (f) => f.category));

  console.log(`\n=== account-wide (final fallback) ===`);
  printTable(aggregate(firstPostByUser, paymentsByUser, () => 'ALL'));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
