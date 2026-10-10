import { DailyActivityDigestJob } from './daily-activity-digest.job';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('DailyActivityDigestJob', () => {
  const now = new Date('2026-10-10T03:30:00Z');
  const OWNER = {
    id: 'owner1',
    email: 'owner@example.com',
    phone: null,
    name: 'Ravi',
  };

  function makePrisma(overrides: Record<string, unknown> = {}) {
    return {
      userNotificationLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      listing: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'listing1', ownerId: 'owner1', owner: OWNER },
          ]),
      },
      listingView: { groupBy: jest.fn().mockResolvedValue([]) },
      favourite: { groupBy: jest.fn().mockResolvedValue([]) },
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
      message: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    };
  }

  function makeJob(
    prisma: ReturnType<typeof makePrisma>,
    notifyResult: 'push' | 'email' | 'whatsapp' | null = 'email',
  ) {
    const notifications = {
      notifyDailyActivityDigest: jest.fn().mockResolvedValue(notifyResult),
    };
    const job = new DailyActivityDigestJob(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    return { job, notifications };
  }

  it('does nothing when there are no live listings', async () => {
    const prisma = makePrisma({
      listing: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const { job, notifications } = makeJob(prisma);
    const sent = await job.sendDigests(now);
    expect(sent).toBe(0);
    expect(notifications.notifyDailyActivityDigest).not.toHaveBeenCalled();
  });

  it('skips an owner with zero views, favourites, and messages', async () => {
    const prisma = makePrisma();
    const { job, notifications } = makeJob(prisma);
    const sent = await job.sendDigests(now);
    expect(sent).toBe(0);
    expect(notifications.notifyDailyActivityDigest).not.toHaveBeenCalled();
  });

  it('aggregates views and favourites across all of one owner listing, and dispatches', async () => {
    const prisma = makePrisma({
      listingView: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ listingId: 'listing1', _count: { _all: 12 } }]),
      },
      favourite: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ listingId: 'listing1', _count: { _all: 3 } }]),
      },
    });
    const { job, notifications } = makeJob(prisma);
    const sent = await job.sendDigests(now);
    expect(sent).toBe(1);
    expect(notifications.notifyDailyActivityDigest).toHaveBeenCalledWith(
      'owner1',
      OWNER,
      { views: 12, favourites: 3, messages: 0 },
    );
  });

  it("counts only messages the owner received, not the owner's own replies", async () => {
    const prisma = makePrisma({
      conversation: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'conv1', listingId: 'listing1', posterId: 'owner1' },
          ]),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([
          { conversationId: 'conv1', senderId: 'buyer1' },
          { conversationId: 'conv1', senderId: 'owner1' },
          { conversationId: 'conv1', senderId: 'buyer1' },
        ]),
      },
    });
    const { job, notifications } = makeJob(prisma);
    await job.sendDigests(now);
    expect(notifications.notifyDailyActivityDigest).toHaveBeenCalledWith(
      'owner1',
      OWNER,
      { views: 0, favourites: 0, messages: 2 },
    );
  });

  it('writes a UserNotificationLog row only when the channel is non-null', async () => {
    const prisma = makePrisma({
      listingView: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ listingId: 'listing1', _count: { _all: 1 } }]),
      },
    });
    const { job } = makeJob(prisma, null);
    const sent = await job.sendDigests(now);
    expect(sent).toBe(0);
    expect(prisma.userNotificationLog.create).not.toHaveBeenCalled();
  });

  it('skips an owner already sent a digest today (same-day dedup)', async () => {
    const prisma = makePrisma({
      listingView: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ listingId: 'listing1', _count: { _all: 5 } }]),
      },
      userNotificationLog: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'owner1' }]),
        create: jest.fn().mockResolvedValue({}),
      },
    });
    const { job, notifications } = makeJob(prisma);
    const sent = await job.sendDigests(now);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    expect(sent).toBe(0);
    expect(notifications.notifyDailyActivityDigest).not.toHaveBeenCalled();
    expect(prisma.userNotificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kind: 'daily_activity_digest', sentAt: { gte: dayStart } },
      }),
    );
  });

  it('continues to the next owner if one throws', async () => {
    const prisma = makePrisma({
      listing: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'listing1', ownerId: 'owner1', owner: OWNER },
          {
            id: 'listing2',
            ownerId: 'owner2',
            owner: { ...OWNER, id: 'owner2' },
          },
        ]),
      },
      listingView: {
        groupBy: jest.fn().mockResolvedValue([
          { listingId: 'listing1', _count: { _all: 1 } },
          { listingId: 'listing2', _count: { _all: 1 } },
        ]),
      },
    });
    const { job, notifications } = makeJob(prisma);
    notifications.notifyDailyActivityDigest
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('push');
    const sent = await job.sendDigests(now);
    expect(sent).toBe(1);
    expect(prisma.userNotificationLog.create).toHaveBeenCalledTimes(1);
  });

  it('bounds the view/favourite window to the trailing 24h ending at now', async () => {
    const prisma = makePrisma();
    const { job } = makeJob(prisma);
    await job.sendDigests(now);
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(prisma.listingView.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          listingId: { in: ['listing1'] },
          createdAt: { gte: windowStart, lt: now },
        },
      }),
    );
  });
});
