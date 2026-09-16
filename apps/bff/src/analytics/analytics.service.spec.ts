import { AnalyticsService } from './analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { GeoIpService } from './geoip.service';

/** The two behaviours worth pinning here are both about *not* losing or corrupting data:
 * a session whose one-shot /analytics/visit call never landed must still become visible
 * (it silently didn't, for ~7% of users), and neither recovery path may overwrite a real
 * first-touch row or re-anonymise one a login already claimed. */
function makePrisma(existingVisit: { sessionId: string; userId: string | null } | null) {
  const upsert = jest.fn().mockResolvedValue({});
  const updateMany = jest.fn().mockResolvedValue({
    // Mirrors Prisma: only an existing row whose userId is still null is matched.
    count: existingVisit && existingVisit.userId === null ? 1 : 0,
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

describe('AnalyticsService', () => {
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
