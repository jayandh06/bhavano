import { AnalyticsService } from './analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { GeoIpService } from './geoip.service';

/** The behaviours worth pinning here are all about *not* losing or corrupting data: a session
 * whose one-shot /analytics/visit call never landed must still become visible (it silently
 * didn't, for ~7% of users); no recovery path may overwrite a real first-touch row or
 * re-anonymise one a login already claimed; and every write has to survive losing an insert race
 * to its sibling for the same brand-new session, which was throwing P2002 on 71% of
 * /analytics/visit calls in production and taking each one's whole attribution with it. */
function makePrisma(
  existingVisit: { sessionId: string; userId: string | null; source?: string | null } | null,
  options: { recentDuplicate?: boolean; collideOnCreate?: boolean } = {},
) {
  // Mirrors Prisma closely enough to tell the two conditional updates apart: `linkVisitToUser`
  // matches on `userId: null`, `recordVisit` on `source: null`, and each must miss when the
  // column it guards on is already filled.
  const updateMany = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (!existingVisit) return Promise.resolve({ count: 0 });
    if ('userId' in where) return Promise.resolve({ count: existingVisit.userId === null ? 1 : 0 });
    if ('source' in where) return Promise.resolve({ count: (existingVisit.source ?? null) === null ? 1 : 0 });
    return Promise.resolve({ count: 1 });
  });
  // `collideOnCreate` stands in for the sibling call having inserted this session's row in the
  // window between the conditional update and this insert. The shape matters: the production code
  // duck-types Prisma's `code === 'P2002'`, so a plain Error here would (correctly) rethrow.
  const visitCreate = jest.fn().mockImplementation(() => {
    if (!options.collideOnCreate) return Promise.resolve({});
    return Promise.reject(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
  });
  const pageViewCreate = jest.fn().mockResolvedValue({});
  // Null unless a test opts in: "no recent view of this path in this session", the normal case.
  const pageViewFindFirst = jest.fn().mockResolvedValue(options.recentDuplicate ? { id: 'pv-recent' } : null);
  return {
    prisma: {
      visit: { create: visitCreate, updateMany },
      pageView: { create: pageViewCreate, findFirst: pageViewFindFirst },
    } as unknown as PrismaService,
    visitCreate,
    updateMany,
    pageViewCreate,
    pageViewFindFirst,
  };
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
  /** Two distinct ways the same race lost a Google Ads click's attribution, both measured in
   * production on 2026-09-16: web's middleware fires /analytics/pageview and /analytics/visit at
   * the same moment on a session's first request, so either the attribution-less backfill commits
   * first and an `upsert ... update: {}` silently discards the real attribution (~50% of
   * sessions), or the two inserts collide and `upsert` throws P2002 (71% of /analytics/visit
   * calls returning 500, web swallowing the failure). The outcome now has to be the same whoever
   * wins. */
  describe('recordVisit', () => {
    it('fills the attribution onto a row the backfill already created', async () => {
      const { prisma, updateMany, visitCreate } = makePrisma({ sessionId: 's1', userId: null, source: null });
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      const args = updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
      expect(args.where).toEqual({ sessionId: 's1', source: null });
      expect(args.data).toMatchObject({
        source: 'google',
        medium: 'cpc',
        campaign: 'rent-out-property',
        gclid: 'Cj0KCQ',
        campaignId: '201629875084',
        adGroupId: '4455',
        landingPath: '/bengaluru/buy/apartment',
      });
      // The row already existed, so nothing may be inserted — and crucially the write went
      // through `updateMany`, not an `upsert` whose empty `update` would have discarded it.
      expect(visitCreate).not.toHaveBeenCalled();
    });

    it('creates the row with full attribution when nothing exists yet', async () => {
      const { prisma, visitCreate } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      const args = visitCreate.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({ sessionId: 's1', source: 'google', medium: 'cpc', gclid: 'Cj0KCQ' });
    });

    it('fills the attribution after losing the insert race', async () => {
      // The row does not exist when the conditional update runs, then the backfill inserts it,
      // then this insert collides. Previously this surfaced as a 500 and the attribution was
      // gone for good.
      const existing = { sessionId: 's1', userId: null, source: null as string | null };
      const { prisma, updateMany, visitCreate } = makePrisma(existing, { collideOnCreate: true });
      updateMany.mockImplementationOnce(() => Promise.resolve({ count: 0 }));

      await expect(new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit)).resolves.toBeUndefined();

      expect(visitCreate).toHaveBeenCalledTimes(1);
      // Tried again after the collision, and that second attempt carries the real attribution.
      expect(updateMany).toHaveBeenCalledTimes(2);
      const retry = updateMany.mock.calls[1][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
      expect(retry.where).toEqual({ sessionId: 's1', source: null });
      expect(retry.data).toMatchObject({ source: 'google', medium: 'cpc', gclid: 'Cj0KCQ' });
    });

    it('rethrows an error that is not a unique-constraint collision', async () => {
      const { prisma, visitCreate } = makePrisma(null);
      visitCreate.mockRejectedValueOnce(new Error('connection lost'));

      await expect(new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit)).rejects.toThrow('connection lost');
    });

    it('leaves a row that already has a real source alone', async () => {
      const { prisma, updateMany } = makePrisma({ sessionId: 's1', userId: null, source: 'direct' }, {
        collideOnCreate: true,
      });
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      // Both fill attempts miss (the guard is `source: null`), and the collision is swallowed —
      // a duplicate/retried send for the same session must not rewrite its first touch.
      expect(updateMany.mock.calls.every(([args]) => (args as { where: Record<string, unknown> }).where.source === null)).toBe(true);
    });
  });

  describe('linkVisitToUser', () => {
    it('links the anonymous visit for that session', async () => {
      const { prisma, updateMany, visitCreate } = makePrisma({ sessionId: 's1', userId: null });
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1');

      expect(updateMany).toHaveBeenCalledWith({
        where: { sessionId: 's1', userId: null },
        data: { userId: 'u1' },
      });
      // Nothing to back-fill — the row was there and got claimed.
      expect(visitCreate).not.toHaveBeenCalled();
    });

    it('creates a visit row when the session never got one', async () => {
      const { prisma, visitCreate } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s-lost', 'u1');

      expect(visitCreate).toHaveBeenCalledWith({ data: { sessionId: 's-lost', userId: 'u1' } });
    });

    it('leaves a row that already names a user alone', async () => {
      const { prisma, visitCreate } = makePrisma({ sessionId: 's1', userId: 'someone-else' });
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1');

      // updateMany matched nothing (userId wasn't null), so the insert runs — and its data
      // carries only sessionId/userId, so even if it somehow landed it could not overwrite
      // attribution.
      expect(visitCreate).toHaveBeenCalledWith({ data: { sessionId: 's1', userId: 'u1' } });
    });

    it('swallows a collision with the session own visit call', async () => {
      const { prisma } = makePrisma(null, { collideOnCreate: true });
      await expect(new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1')).resolves.toBeUndefined();
    });
  });

  describe('recordPageView', () => {
    it('records the page view and back-fills a missing visit from this request', async () => {
      const { prisma, pageViewCreate, visitCreate } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordPageView({
        sessionId: 's-lost',
        path: '/bengaluru/koramangala',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0 (iPhone)',
      });

      expect(pageViewCreate).toHaveBeenCalledWith({
        data: { sessionId: 's-lost', path: '/bengaluru/koramangala' },
      });
      const args = visitCreate.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({
        sessionId: 's-lost',
        landingPath: '/bengaluru/koramangala',
        ip: '203.0.113.9',
      });
      // Attribution stays unknown rather than being re-derived — a null source is distinguishable
      // from the literal "direct" the middleware writes for a genuine direct visit.
      expect(args.data.source).toBeUndefined();
      expect(args.data.medium).toBeUndefined();
    });

    it('keeps the page view when the visit row already exists', async () => {
      // The overwhelmingly common case on every navigation after the first: the insert collides
      // and there is deliberately nothing to do. It must not surface as a 500.
      const { prisma, pageViewCreate } = makePrisma(null, { collideOnCreate: true });
      await expect(
        new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's1', path: '/help' }),
      ).resolves.toBeUndefined();

      expect(pageViewCreate).toHaveBeenCalled();
    });

    it('drops a repeat of the same path within the dedupe window', async () => {
      const { prisma, pageViewCreate, pageViewFindFirst, visitCreate } = makePrisma(null, {
        recentDuplicate: true,
      });
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's1', path: '/post' });

      const args = pageViewFindFirst.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(args.where).toMatchObject({ sessionId: 's1', path: '/post' });
      // The safety net for background fetchers the middleware's navigation gate doesn't
      // recognise: one path fetched 42 times in a session is not 42 page views.
      expect(pageViewCreate).not.toHaveBeenCalled();
      // And no backfill either — the view this duplicates already did that.
      expect(visitCreate).not.toHaveBeenCalled();
    });

    it('keeps a repeat of a different path in the same session', async () => {
      const { prisma, pageViewCreate } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's1', path: '/favourites' });

      expect(pageViewCreate).toHaveBeenCalledWith({ data: { sessionId: 's1', path: '/favourites' } });
    });

    it('still records the page view when no ip/userAgent is sent', async () => {
      const { prisma, pageViewCreate, visitCreate } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's2', path: '/' });

      expect(pageViewCreate).toHaveBeenCalled();
      const args = visitCreate.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(args.data).toMatchObject({ sessionId: 's2', deviceType: null });
    });
  });
});
