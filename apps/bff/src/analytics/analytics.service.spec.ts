import { AnalyticsService } from './analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { GeoIpService } from './geoip.service';

/** These pin the *shape* of each statement and which columns it may touch. The merge semantics
 * themselves (CASE/COALESCE against a real row) cannot be proved with a mock — Postgres has to
 * evaluate them — so they are verified separately against a live database; see the raw-SQL note
 * at the top of analytics.service.ts. What a mock *can* pin, and what actually broke in
 * production, is per-writer column ownership: attribution's writer must never mention userId, and
 * login's must never mention anything else. */
function makePrisma(recentDuplicate = false) {
  // Mirrors Prisma's tagged-template signature: (TemplateStringsArray, ...boundValues).
  const executeRaw = jest.fn().mockResolvedValue(1);
  const pageViewCreate = jest.fn().mockResolvedValue({});
  const pageViewFindFirst = jest.fn().mockResolvedValue(recentDuplicate ? { id: 'pv-recent' } : null);
  return {
    prisma: {
      $executeRaw: executeRaw,
      pageView: { create: pageViewCreate, findFirst: pageViewFindFirst },
    } as unknown as PrismaService,
    executeRaw,
    pageViewCreate,
    pageViewFindFirst,
  };
}

/** The SQL text of the nth $executeRaw call, with runs of whitespace collapsed so assertions
 * don't depend on the source's indentation. */
function sqlOf(executeRaw: jest.Mock, call = 0): string {
  const strings = executeRaw.mock.calls[call][0] as string[];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

function paramsOf(executeRaw: jest.Mock, call = 0): unknown[] {
  return executeRaw.mock.calls[call].slice(1) as unknown[];
}

const geoIp = { lookupCity: () => null } as unknown as GeoIpService;

const googleAdsVisit = {
  sessionId: 's1',
  source: 'google',
  medium: 'cpc',
  campaign: 'rent-out-property',
  gclid: 'Cj0KCQ',
  campaignId: '201629875084',
  adGroupId: '4455',
  adId: '9911',
  landingPath: '/bengaluru/buy/apartment',
  ip: '203.0.113.9',
  userAgent: 'Mozilla/5.0 (iPhone)',
};

describe('AnalyticsService', () => {
  describe('recordVisit', () => {
    it('inserts or completes the row in one atomic statement', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      const sql = sqlOf(executeRaw);
      expect(sql).toContain('INSERT INTO "Visit"');
      // The whole point: no select-then-insert, so there is no window for the sibling call to
      // collide in. Prisma's own upsert cannot express this.
      expect(sql).toContain('ON CONFLICT ("sessionId") DO UPDATE');
      // Every column gated on the one predicate, so attribution lands as a unit and can never be
      // half-written from two different requests.
      expect(sql).toContain('CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."source"');
      expect(sql).toContain('CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."gclid"');
      expect(sql).toContain('CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."landingPath"');
    });

    it('carries the full attribution as bound parameters, never interpolated', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      const params = paramsOf(executeRaw);
      expect(params).toEqual(
        expect.arrayContaining([
          's1', 'google', 'cpc', 'rent-out-property', 'Cj0KCQ', '201629875084', '4455', '9911',
          '/bengaluru/buy/apartment', '203.0.113.9',
        ]),
      );
      // Not present in the SQL text itself — an attacker-supplied source or landingPath is data.
      expect(sqlOf(executeRaw)).not.toContain('google');
    });

    it('never touches userId', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      // A first-touch write must not be able to unclaim a session that login already claimed —
      // the column is owned by linkVisitToUser and absent from this statement entirely.
      expect(sqlOf(executeRaw)).not.toContain('userId');
    });

    it('sends nulls rather than undefined for absent fields', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordVisit({ sessionId: 's2', source: 'direct' });

      // Prisma's raw layer rejects undefined as a bound parameter, so every optional field has to
      // be normalised before it gets here.
      expect(paramsOf(executeRaw)).not.toContain(undefined);
    });
  });

  describe('linkVisitToUser', () => {
    it('claims the session only while it is unclaimed, in one statement', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1');

      const sql = sqlOf(executeRaw);
      expect(sql).toContain('INSERT INTO "Visit"');
      // COALESCE is the "only ever fills a null" rule: a session already claimed by another
      // account keeps it (two people on a shared desktop), and neither claim is ours to overwrite.
      expect(sql).toContain('COALESCE("Visit"."userId", EXCLUDED."userId")');
      expect(paramsOf(executeRaw)).toEqual([expect.any(String), 's1', 'u1']);
    });

    it('touches no column but userId', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1');

      const sql = sqlOf(executeRaw);
      for (const column of ['source', 'medium', 'campaign', 'gclid', 'landingPath', 'deviceType']) {
        expect(sql).not.toContain(column);
      }
    });
  });

  describe('confirmJsExecution', () => {
    it('owns jsConfirmedAt and touches nothing else', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).confirmJsExecution('s1');

      const sql = sqlOf(executeRaw);
      expect(sql).toContain('INSERT INTO "Visit"');
      // Keeps the FIRST confirmation: the interesting number is how long after the request the
      // page came alive, which a later navigation's beacon would erase.
      expect(sql).toContain('COALESCE("Visit"."jsConfirmedAt", EXCLUDED."jsConfirmedAt")');
      for (const column of ['source', 'medium', 'gclid', 'landingPath', 'isBot', 'userId']) {
        expect(sql).not.toContain(column);
      }
      expect(paramsOf(executeRaw)).toEqual([expect.any(String), 's1']);
    });

    it('takes no client-supplied facts beyond the session id', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).confirmJsExecution('s1');

      // The signal is that the request happened at all — anything the client *tells* us here
      // would be exactly as spoofable as the User-Agent that isBot already fails on. The
      // timestamp comes from the database (NOW()), not from the caller.
      expect(paramsOf(executeRaw)).toHaveLength(2);
      expect(sqlOf(executeRaw)).toContain('NOW()');
    });
  });

  describe('recordPageView', () => {
    it('records the view and inserts the visit row only if absent', async () => {
      const { prisma, pageViewCreate, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordPageView({
        sessionId: 's-lost',
        path: '/bengaluru/koramangala',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0 (iPhone)',
      });

      expect(pageViewCreate).toHaveBeenCalledWith({
        data: { sessionId: 's-lost', path: '/bengaluru/koramangala' },
      });
      const sql = sqlOf(executeRaw);
      // This writer owns no column another writer could want, so DO NOTHING is the whole of its
      // conflict handling: if the row exists, the desired end state is already reached.
      expect(sql).toContain('ON CONFLICT ("sessionId") DO NOTHING');
      expect(paramsOf(executeRaw)).toEqual(
        expect.arrayContaining(['s-lost', '/bengaluru/koramangala', '203.0.113.9', 'mobile']),
      );
    });

    it('writes no attribution, so a recovered row stays distinguishable from a real one', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's-lost', path: '/' });

      // Attribution is never re-derived here — web's 30-day acquisition cookie is first-touch
      // across *sessions*, so reading it would stamp this session with an earlier one's source.
      const sql = sqlOf(executeRaw);
      for (const column of ['source', 'medium', 'campaign', 'gclid', 'campaignId', 'userId']) {
        expect(sql).not.toContain(column);
      }
    });

    it('drops a repeat of the same path within the dedupe window', async () => {
      const { prisma, pageViewCreate, pageViewFindFirst, executeRaw } = makePrisma(true);
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's1', path: '/post' });

      const args = pageViewFindFirst.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(args.where).toMatchObject({ sessionId: 's1', path: '/post' });
      // The safety net for background fetchers the middleware's navigation gate doesn't
      // recognise: one path fetched 42 times in a session is not 42 page views.
      expect(pageViewCreate).not.toHaveBeenCalled();
      // And no backfill either — the view this duplicates already did that.
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('keeps a repeat of a different path in the same session', async () => {
      const { prisma, pageViewCreate } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's1', path: '/favourites' });

      expect(pageViewCreate).toHaveBeenCalledWith({ data: { sessionId: 's1', path: '/favourites' } });
    });

    it('still records the page view when no ip/userAgent is sent', async () => {
      const { prisma, pageViewCreate, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's2', path: '/' });

      expect(pageViewCreate).toHaveBeenCalled();
      expect(paramsOf(executeRaw)).not.toContain(undefined);
    });

    it('classifies a fromApp pageview backfill as mobile_app', async () => {
      const { prisma, executeRaw } = makePrisma();
      await new AnalyticsService(prisma, geoIp).recordPageView({
        sessionId: 's-app',
        path: '/post/preview',
        userAgent: 'okhttp/4.x',
        fromApp: true,
      });

      expect(paramsOf(executeRaw)).toEqual(
        expect.arrayContaining(['s-app', '/post/preview', 'mobile_app']),
      );
    });
  });
});
