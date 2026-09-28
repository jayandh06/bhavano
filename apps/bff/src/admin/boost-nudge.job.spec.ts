import { BoostNudgeJob } from './boost-nudge.job';
import type { PrismaService } from '../prisma/prisma.service';
import type { AdminService } from './admin.service';

function makeJob(opts: { candidates?: Array<{ id: string; ownerId: string }>; views?: Record<string, number>; admin?: { id: string } | null } = {}) {
  const prisma = {
    listing: { findMany: jest.fn().mockResolvedValue(opts.candidates ?? []) },
    listingView: {
      groupBy: jest
        .fn()
        .mockResolvedValue(Object.entries(opts.views ?? {}).map(([listingId, n]) => ({ listingId, _count: { _all: n } }))),
    },
    user: { findFirst: jest.fn().mockResolvedValue(opts.admin === undefined ? { id: 'admin1' } : opts.admin) },
  } as unknown as PrismaService;
  const adminService = {
    sendBoostPromotion: jest.fn().mockImplementation((ids: string[]) =>
      Promise.resolve({ sent: ids.length, failed: 0, results: ids.map((listingId) => ({ listingId, success: true })) }),
    ),
  } as unknown as AdminService;
  return { job: new BoostNudgeJob(prisma, adminService), prisma, adminService };
}

describe('BoostNudgeJob', () => {
  afterEach(() => {
    delete process.env.BOOST_NUDGE_AUTO_ENABLED;
    delete process.env.BOOST_NUDGE_SENDER_USER_ID;
  });

  it('does nothing at all unless explicitly switched on', async () => {
    const { job, prisma } = makeJob({ candidates: [{ id: 'l1', ownerId: 'o1' }] });
    await job.run();
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it('runs when BOOST_NUDGE_AUTO_ENABLED=true', async () => {
    process.env.BOOST_NUDGE_AUTO_ENABLED = 'true';
    const { job, adminService } = makeJob({ candidates: [{ id: 'l1', ownerId: 'o1' }] });
    await job.run();
    expect(adminService.sendBoostPromotion).toHaveBeenCalledWith(['l1'], { channel: 'in_app', adminId: 'admin1' });
  });

  it('only nudges ads with almost no views', async () => {
    const { job, adminService } = makeJob({
      candidates: [
        { id: 'quiet', ownerId: 'o1' },
        { id: 'busy', ownerId: 'o2' },
      ],
      views: { quiet: 1, busy: 9 },
    });
    expect(await job.nudgeQuietListings()).toBe(1);
    expect(adminService.sendBoostPromotion).toHaveBeenCalledWith(['quiet'], expect.anything());
  });

  it('sends one message per owner, not one per ad', async () => {
    const { job, adminService } = makeJob({
      candidates: [
        { id: 'a', ownerId: 'o1' },
        { id: 'b', ownerId: 'o1' },
        { id: 'c', ownerId: 'o2' },
      ],
    });
    await job.nudgeQuietListings();
    expect(adminService.sendBoostPromotion).toHaveBeenCalledWith(['a', 'c'], expect.anything());
  });

  it('caps a single run', async () => {
    const candidates = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, ownerId: `o${i}` }));
    const { job, adminService } = makeJob({ candidates });
    await job.nudgeQuietListings();
    const ids = (adminService.sendBoostPromotion as jest.Mock).mock.calls[0][0] as string[];
    expect(ids).toHaveLength(25);
  });

  it('selects live, unboosted, 1–3 day old ads never nudged in-app, owned by non-admins', async () => {
    const now = new Date('2026-09-28T10:00:00Z');
    const { job, prisma } = makeJob();
    await job.nudgeQuietListings(now);
    const where = (prisma.listing.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(where.notificationLogs).toEqual({ none: { kind: 'boost_promo', channel: 'in_app' } });
    expect(where.owner.role).toBe('user');
    expect(where.owner.listings.none.notificationLogs.some).toMatchObject({ kind: 'boost_promo', channel: 'in_app' });
    expect((where.createdAt.lte as Date).toISOString()).toBe('2026-09-27T10:00:00.000Z');
    expect((where.createdAt.gte as Date).toISOString()).toBe('2026-09-25T10:00:00.000Z');
  });

  it('sends nothing, and says so, when there is no admin to send from', async () => {
    const { job, adminService } = makeJob({ candidates: [{ id: 'l1', ownerId: 'o1' }], admin: null });
    expect(await job.nudgeQuietListings()).toBe(0);
    expect(adminService.sendBoostPromotion).not.toHaveBeenCalled();
  });

  it('prefers a configured sender', async () => {
    process.env.BOOST_NUDGE_SENDER_USER_ID = 'configured-admin';
    const { job, adminService, prisma } = makeJob({ candidates: [{ id: 'l1', ownerId: 'o1' }] });
    await job.nudgeQuietListings();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(adminService.sendBoostPromotion).toHaveBeenCalledWith(['l1'], { channel: 'in_app', adminId: 'configured-admin' });
  });
});
