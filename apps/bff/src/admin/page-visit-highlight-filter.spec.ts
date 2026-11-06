import { AdminService } from './admin.service';

const NOW = new Date('2026-11-01T10:00:00Z');

/** The `highlight` filter on the Page visits list: the same five rules as the row colours, as database queries. */
function makeService(over: { paid?: string[]; subscriptions?: string[]; running?: string[]; adSessions?: string[]; logins?: string[]; requirementSessions?: string[] } = {}) {
  const prisma = {
    payment: { groupBy: jest.fn().mockResolvedValue((over.paid ?? []).map((userId) => ({ userId }))) },
    userSubscription: { findMany: jest.fn().mockResolvedValue((over.subscriptions ?? []).map((userId) => ({ userId }))) },
    listing: {
      findMany: jest.fn().mockImplementation((args: { select: Record<string, boolean> }) =>
        Promise.resolve(
          args.select.createSessionId
            ? (over.adSessions ?? []).map((createSessionId) => ({ createSessionId }))
            : (over.running ?? []).map((ownerId) => ({ ownerId })),
        ),
      ),
    },
    $queryRaw: jest.fn().mockResolvedValue((over.requirementSessions ?? []).map((sessionId) => ({ sessionId }))),
    loginEvent: { findMany: jest.fn().mockResolvedValue((over.logins ?? []).map((sessionId) => ({ sessionId }))) },
  };
  const none = {} as never;
  const service = new AdminService(prisma as never, none, none, none, none, none, none, none, none, none, none, none, none, none, none);
  const where = (h: 'any' | 'ad' | 'featured' | 'requirement' | 'purchased' | 'active') =>
    (service as unknown as { highlightWhere: (h: string, now: Date) => Promise<unknown> }).highlightWhere(h, NOW);
  return { prisma, where };
}

describe('page visits highlight filter', () => {
  it('ad: sessions that posted a live or pipeline ad', async () => {
    const { prisma, where } = makeService({ adSessions: ['s1', 's2'] });
    expect(await where('ad')).toEqual({ sessionId: { in: ['s1', 's2'] } });
    const q = prisma.listing.findMany.mock.calls[0][0];
    expect(q.where.createSessionId).toEqual({ not: null });
    expect(q.where.OR).toEqual([
      { publishState: 'live', status: 'active', expiresAt: { gt: NOW } },
      { publishState: { in: ['pending_checkout', 'scheduled'] } },
    ]);
  });

  it('featured: sessions whose listing ever had a boost', async () => {
    const { prisma, where } = makeService({ adSessions: ['s9'] });
    expect(await where('featured')).toEqual({ sessionId: { in: ['s9'] } });
    expect(prisma.listing.findMany.mock.calls[0][0].where.listingBoosts).toEqual({ some: {} });
  });

  it('purchased: the paying accounts and the sessions they logged in during', async () => {
    const { prisma, where } = makeService({ paid: ['u1', 'u2'], logins: ['s5'] });
    expect(await where('purchased')).toEqual({ OR: [{ userId: { in: ['u1', 'u2'] } }, { sessionId: { in: ['s5'] } }] });
    expect(prisma.payment.groupBy.mock.calls[0][0].where).toEqual({ status: 'paid', amount: { gt: 0 } });
  });

  it('active: unexpired subscriptions plus owners of a running boost or alerts window', async () => {
    const { where } = makeService({ subscriptions: ['u1'], running: ['u2', 'u1'] });
    const clause = (await where('active')) as { OR: [{ userId: { in: string[] } }] };
    expect([...clause.OR[0].userId.in].sort()).toEqual(['u1', 'u2']);
  });

  it('matches nothing, rather than everything, when no account qualifies', async () => {
    const { where } = makeService({ paid: [] });
    expect(await where('purchased')).toEqual({ id: { in: [] } });
  });

  it('requirement: sessions in which an account saved a requirement', async () => {
    const { where } = makeService({ requirementSessions: ['s3'] });
    expect(await where('requirement')).toEqual({ sessionId: { in: ['s3'] } });
  });

  it('any: all five rules ORed together', async () => {
    const { where } = makeService({ adSessions: ['s1'], paid: ['u1'], subscriptions: ['u1'] });
    const clause = (await where('any')) as { OR: unknown[] };
    expect(clause.OR).toHaveLength(5);
  });
});
