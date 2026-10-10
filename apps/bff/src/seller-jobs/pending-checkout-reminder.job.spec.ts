import { PendingCheckoutReminderJob } from './pending-checkout-reminder.job';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('PendingCheckoutReminderJob', () => {
  const now = new Date('2026-10-10T03:30:00Z');
  const hour = 3_600_000;
  const WINDOW_START_HOURS = 4;
  const WINDOW_END_HOURS = 3;

  function stubListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 'listing1',
      title: 'Nice flat',
      createdAt: new Date(now.getTime() - WINDOW_START_HOURS * hour + 1000),
      owner: {
        id: 'owner1',
        email: 'owner@example.com',
        phone: null,
        name: 'Ravi',
      },
      ...overrides,
    };
  }

  function makeJob(listings: ReturnType<typeof stubListing>[]) {
    const prisma = {
      listing: { findMany: jest.fn().mockResolvedValue(listings) },
      listingNotificationLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const notifications = {
      notifyPendingCheckoutReminder: jest.fn().mockResolvedValue('email'),
    };
    const job = new PendingCheckoutReminderJob(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    return { job, prisma, notifications };
  }

  it('looks only at currently-pending-checkout listings created 3-4h ago with no existing reminder log', async () => {
    const { job, prisma } = makeJob([]);
    await job.sendReminders(now);
    const windowStart = new Date(now.getTime() - WINDOW_START_HOURS * hour);
    const windowEnd = new Date(now.getTime() - WINDOW_END_HOURS * hour);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publishState: 'pending_checkout',
          createdAt: { gte: windowStart, lt: windowEnd },
          notificationLogs: { none: { kind: 'pending_checkout_reminder' } },
        },
      }),
    );
  });

  it('sends the reminder and logs the channel for a listing inside the window', async () => {
    const { job, notifications, prisma } = makeJob([stubListing()]);
    await job.sendReminders(now);
    expect(notifications.notifyPendingCheckoutReminder).toHaveBeenCalledWith(
      'owner1',
      expect.objectContaining({ id: 'owner1' }),
      'Nice flat',
      'listing1',
    );
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'listing1',
        kind: 'pending_checkout_reminder',
        channel: 'email',
      },
    });
  });

  it('does not write a log row when the notification channel is null', async () => {
    const { job, prisma, notifications } = makeJob([stubListing()]);
    notifications.notifyPendingCheckoutReminder.mockResolvedValue(null);
    await job.sendReminders(now);
    expect(prisma.listingNotificationLog.create).not.toHaveBeenCalled();
  });

  it('continues to the next listing if one throws', async () => {
    const { job, prisma, notifications } = makeJob([
      stubListing({ id: 'bad' }),
      stubListing({ id: 'good' }),
    ]);
    notifications.notifyPendingCheckoutReminder
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('whatsapp');
    await job.sendReminders(now);
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'good',
        kind: 'pending_checkout_reminder',
        channel: 'whatsapp',
      },
    });
  });

  it('window boundaries are exactly 3-4h: the query itself is what the DB uses to exclude listings outside that range', async () => {
    // The job delegates the actual age filtering to the DB query (asserted above); this pins the
    // two boundary timestamps explicitly so a future edit to WINDOW_START_HOURS/WINDOW_END_HOURS
    // is caught by a changed assertion here, not just a passing mock.
    const { job, prisma } = makeJob([]);
    await job.sendReminders(now);
    const [[call]] = (prisma.listing.findMany as jest.Mock).mock.calls.map((args: unknown[]) => args);
    const where = (call as { where: { createdAt: { gte: Date; lt: Date } } }).where;
    expect(where.createdAt.gte.toISOString()).toBe(new Date(now.getTime() - 4 * hour).toISOString());
    expect(where.createdAt.lt.toISOString()).toBe(new Date(now.getTime() - 3 * hour).toISOString());
  });
});
