/**
 * Verifies AnalyticsService's `INSERT ... ON CONFLICT` merge semantics against a real Postgres.
 *
 * Run it after touching any of the raw SQL in analytics.service.ts:
 *
 *   cd apps/bff && set -a && . ./.env && set +a && node_modules/.bin/tsx scripts/check-visit-merge.ts
 *
 * It exists because the unit suite cannot cover this. Those three statements delegate the entire
 * decision — who wins when two writers reach the same `Visit` row — to CASE and COALESCE
 * expressions that only Postgres can evaluate, so a mocked client can pin the statement's shape
 * and its bound parameters but not what it actually does. The bug this replaced was invisible to
 * mocks for exactly that reason: `upsert` looked correct and lost 71% of attribution in
 * production.
 *
 * Every ordering the middleware can produce is exercised, plus 20 genuinely concurrent
 * first-requests, and it deletes its own rows afterwards. Writes to whatever DATABASE_URL points
 * at — a local database, never production.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AnalyticsService } from '../src/analytics/analytics.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { GeoIpService } from '../src/analytics/geoip.service';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const geoIp = { lookupCity: () => ({ city: 'Bengaluru', region: 'Karnataka', country: 'India' }) } as unknown as GeoIpService;
const svc = new AnalyticsService(prisma as unknown as PrismaService, geoIp);

const UA = 'Mozilla/5.0 (iPhone)';
const ads = (sessionId: string) => ({
  sessionId, source: 'google', medium: 'cpc', campaign: 'camp', gclid: 'GCL', campaignId: '111',
  adGroupId: '222', adId: '333', landingPath: '/real-landing', ip: '203.0.113.9', userAgent: UA,
});
const view = (sessionId: string, path = '/later-page') => ({ sessionId, path, ip: '203.0.113.9', userAgent: UA });

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) { failures++; if (detail !== undefined) console.log('        got:', JSON.stringify(detail)); }
}

(async () => {
  const ids: string[] = [];
  const sid = (n: string) => { const s = `sem-${Date.now()}-${n}`; ids.push(s); return s; };

  // 1. Backfill first, then the real visit — the ordering that lost all attribution.
  let s = sid('backfill-first');
  await svc.recordPageView(view(s));
  await svc.recordVisit(ads(s));
  let row = await prisma.visit.findUnique({ where: { sessionId: s } });
  check('backfill-then-visit keeps full attribution',
    row?.source === 'google' && row?.gclid === 'GCL' && row?.campaignId === '111' && row?.adGroupId === '222', row);
  check('backfill-then-visit takes the REAL landing path, not the later page',
    row?.landingPath === '/real-landing', row?.landingPath);

  // 2. Real visit first, then a later page view — must not be downgraded.
  s = sid('visit-first');
  await svc.recordVisit(ads(s));
  await svc.recordPageView(view(s));
  row = await prisma.visit.findUnique({ where: { sessionId: s } });
  check('visit-then-backfill keeps attribution and landing path',
    row?.source === 'google' && row?.landingPath === '/real-landing', row);

  // 3. A duplicate/retried send must not rewrite a real first touch.
  s = sid('duplicate');
  await svc.recordVisit(ads(s));
  await svc.recordVisit({ ...ads(s), source: 'spam', medium: 'spam', gclid: 'SPAM', landingPath: '/spam' });
  row = await prisma.visit.findUnique({ where: { sessionId: s } });
  check('duplicate send leaves the first touch alone',
    row?.source === 'google' && row?.gclid === 'GCL' && row?.landingPath === '/real-landing', row);

  // 4. Login claims an unclaimed session, and attribution survives it.
  s = sid('login');
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) { console.log('SKIP  login checks (no user rows locally)'); }
  else {
    await svc.recordVisit(ads(s));
    await svc.linkVisitToUser(s, user.id);
    row = await prisma.visit.findUnique({ where: { sessionId: s } });
    check('login claims the session without disturbing attribution',
      row?.userId === user.id && row?.source === 'google' && row?.gclid === 'GCL', row);

    // 5. Attribution arriving AFTER login must not unclaim the session.
    s = sid('login-first');
    await svc.linkVisitToUser(s, user.id);
    await svc.recordVisit(ads(s));
    row = await prisma.visit.findUnique({ where: { sessionId: s } });
    check('visit after login fills attribution and keeps the user',
      row?.userId === user.id && row?.source === 'google', row);

    // 6. A second account must not steal a claimed session.
    const other = await prisma.user.findFirst({ where: { id: { not: user.id } }, select: { id: true } });
    if (other) {
      await svc.linkVisitToUser(s, other.id);
      row = await prisma.visit.findUnique({ where: { sessionId: s } });
      check('a second account cannot steal a claimed session', row?.userId === user.id, row?.userId);
    } else console.log('SKIP  second-account check (only one user row locally)');
  }

  // 7. The JS beacon owns jsConfirmedAt and must disturb nothing else, in either order.
  s = sid('js-after');
  await svc.recordVisit(ads(s));
  await svc.confirmJsExecution(s);
  row = await prisma.visit.findUnique({ where: { sessionId: s } });
  check('js confirmation keeps attribution intact',
    row?.jsConfirmedAt instanceof Date && row?.source === 'google' && row?.gclid === 'GCL', row);

  s = sid('js-first');
  await svc.confirmJsExecution(s);
  await svc.recordVisit(ads(s));
  row = await prisma.visit.findUnique({ where: { sessionId: s } });
  check('attribution arriving after the beacon keeps the confirmation',
    row?.jsConfirmedAt instanceof Date && row?.source === 'google', row);

  const firstConfirm = row?.jsConfirmedAt?.getTime();
  await svc.confirmJsExecution(s);
  row = await prisma.visit.findUnique({ where: { sessionId: s } });
  check('a repeat beacon keeps the FIRST confirmation time',
    row?.jsConfirmedAt?.getTime() === firstConfirm, { was: firstConfirm, now: row?.jsConfirmedAt?.getTime() });

  // 8. True concurrency, both calls at once, 20 brand-new sessions.
  const raceIds = Array.from({ length: 20 }, (_, i) => sid(`race${i}`));
  await Promise.all(raceIds.map((id) => Promise.all([svc.recordPageView(view(id, '/')), svc.recordVisit(ads(id))])));
  const raced = await prisma.visit.findMany({ where: { sessionId: { in: raceIds } } });
  check(`20 concurrent first-requests all created a row (${raced.length}/20)`, raced.length === 20);
  const intact = raced.filter((r) => r.source === 'google' && r.gclid === 'GCL' && r.campaignId === '111');
  check(`all 20 kept full attribution (${intact.length}/${raced.length})`, intact.length === raced.length);

  const pv = await prisma.pageView.deleteMany({ where: { sessionId: { in: ids } } });
  const v = await prisma.visit.deleteMany({ where: { sessionId: { in: ids } } });
  console.log(`\ncleaned up: ${v.count} visit, ${pv.count} pageview`);
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
