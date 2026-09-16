import { AnalyticsService } from './analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { GeoIpService } from './geoip.service';

/** The two behaviours worth pinning here are both about *not* losing or corrupting data:
 * a session whose one-shot /analytics/visit call never landed must still become visible
 * (it silently didn't, for ~7% of users), and neither recovery path may overwrite a real
 * first-touch row or re-anonymise one a login already claimed. */
function makePrisma(existingVisit: { sessionId: string; userId: string | null; source?: string | null } | null) {
  const upsert = jest.fn().mockResolvedValue({});
  // Mirrors Prisma closely enough to tell the two conditional updates apart: `linkVisitToUser`
  // matches on `userId: null`, `recordVisit` on `source: null`, and each must miss when the
  // column it guards on is already filled.
  const updateMany = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (!existingVisit) return Promise.resolve({ count: 0 });
    if ('userId' in where) return Promise.resolve({ count: existingVisit.userId === null ? 1 : 0 });
    if ('source' in where) return Promise.resolve({ count: (existingVisit.source ?? null) === null ? 1 : 0 });
    return Promise.resolve({ count: 1 });
  });
  const pageViewCreate = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      visit: { upsert, updateMany },
      pageView: { create: pageViewCreate },
    } as unknown as PrismaService,
    upsert,
    updateMany,
    pageViewCreate,
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
  /** The regression these cover: web's middleware fires /analytics/pageview before
   * /analytics/visit on a session's first request, so the attribution-less backfill usually
   * creates the Visit row first. With an empty `update` this threw away the source/medium/
   * campaign/gclid of every Google Ads click that lost that race — ~50% of sessions. */
  describe('recordVisit', () => {
    it('fills the attribution onto a row the backfill already created', async () => {
      const { prisma, updateMany, upsert } = makePrisma({ sessionId: 's1', userId: null, source: null });
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
      // The row already existed, so nothing may be created — and crucially the write went
      // through `updateMany`, not an `upsert` whose empty `update` would have discarded it.
      expect(upsert).not.toHaveBeenCalled();
    });

    it('creates the row with full attribution when nothing exists yet', async () => {
      const { prisma, upsert } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      const args = upsert.mock.calls[0][0] as { create: Record<string, unknown> };
      expect(args.create).toMatchObject({ sessionId: 's1', source: 'google', medium: 'cpc', gclid: 'Cj0KCQ' });
    });

    it('leaves a row that already has a real source alone', async () => {
      const { prisma, upsert } = makePrisma({ sessionId: 's1', userId: null, source: 'direct' });
      await new AnalyticsService(prisma, geoIp).recordVisit(googleAdsVisit);

      // A duplicate/retried send for the same session must not rewrite its first touch.
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    });
  });

  describe('linkVisitToUser', () => {
    it('links the anonymous visit for that session', async () => {
      const { prisma, updateMany, upsert } = makePrisma({ sessionId: 's1', userId: null });
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1');

      expect(updateMany).toHaveBeenCalledWith({
        where: { sessionId: 's1', userId: null },
        data: { userId: 'u1' },
      });
      // Nothing to back-fill — the row was there and got claimed.
      expect(upsert).not.toHaveBeenCalled();
    });

    it('creates a visit row when the session never got one', async () => {
      const { prisma, upsert } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s-lost', 'u1');

      expect(upsert).toHaveBeenCalledWith({
        where: { sessionId: 's-lost' },
        update: {},
        create: { sessionId: 's-lost', userId: 'u1' },
      });
    });

    it('leaves a row that already names a user alone', async () => {
      const { prisma, upsert } = makePrisma({ sessionId: 's1', userId: 'someone-else' });
      await new AnalyticsService(prisma, geoIp).linkVisitToUser('s1', 'u1');

      // updateMany matched nothing (userId wasn't null), so the fallback runs — but as an upsert
      // with an empty `update`, so the existing attribution survives.
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    });
  });

  describe('recordPageView', () => {
    it('records the page view and back-fills a missing visit from this request', async () => {
      const { prisma, pageViewCreate, upsert } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordPageView({
        sessionId: 's-lost',
        path: '/bengaluru/koramangala',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0 (iPhone)',
      });

      expect(pageViewCreate).toHaveBeenCalledWith({
        data: { sessionId: 's-lost', path: '/bengaluru/koramangala' },
      });
      const args = upsert.mock.calls[0][0] as {
        where: { sessionId: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      };
      expect(args.where).toEqual({ sessionId: 's-lost' });
      // Empty update: an existing first-touch row must never be rewritten by a later navigation.
      expect(args.update).toEqual({});
      expect(args.create).toMatchObject({
        sessionId: 's-lost',
        landingPath: '/bengaluru/koramangala',
        ip: '203.0.113.9',
      });
      // Attribution stays unknown rather than being re-derived — a null source is distinguishable
      // from the literal "direct" the middleware writes for a genuine direct visit.
      expect(args.create.source).toBeUndefined();
      expect(args.create.medium).toBeUndefined();
    });

    it('still records the page view when no ip/userAgent is sent', async () => {
      const { prisma, pageViewCreate, upsert } = makePrisma(null);
      await new AnalyticsService(prisma, geoIp).recordPageView({ sessionId: 's2', path: '/' });

      expect(pageViewCreate).toHaveBeenCalled();
      const args = upsert.mock.calls[0][0] as { create: Record<string, unknown> };
      expect(args.create).toMatchObject({ sessionId: 's2', deviceType: null });
    });
  });
});
