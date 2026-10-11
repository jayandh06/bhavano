import { PendingCheckoutReminderJob } from './pending-checkout-reminder.job';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('PendingCheckoutReminderJob', () => {
  const now = new Date('2026-10-10T03:30:00Z');
  const hour = 3_600_000;
  const MIN_AGE_HOURS = 3;

  // 5h old, not 3h — deliberately well past the old closed-band design's 3-4h window, to pin
  // down that the open-ended query (see the job's own MIN_AGE_HOURS comment) really does catch a
  // listing that's been stuck far longer than one hourly cycle, not just one freshly crossing
  // the 3h mark.
  function stubListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 'listing1',
      title: 'Nice flat',
      createdAt: new Date(now.getTime() - 5 * hour),
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

  it('looks only at currently-pending-checkout listings at least 3h old with no existing reminder log — open-ended, no upper bound', async () => {
    const { job, prisma } = makeJob([]);
    await job.sendReminders(now);
    const cutoff = new Date(now.getTime() - MIN_AGE_HOURS * hour);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publishState: 'pending_checkout',
          createdAt: { lte: cutoff },
          notificationLogs: { none: { kind: 'pending_checkout_reminder' } },
        },
      }),
    );
  });

  it('sends the reminder and logs the channel for a listing stuck well past the 3h mark', async () => {
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

  it('the cutoff is exactly 3h with no upper bound: a missed hourly run is still caught on the next one', async () => {
    // Pins the single boundary timestamp explicitly so a future edit to MIN_AGE_HOURS, or a
    // regression back to a closed band, is caught by a changed assertion here rather than only a
    // passing mock.
    const { job, prisma } = makeJob([]);
    await job.sendReminders(now);
    const [[call]] = (prisma.listing.findMany as jest.Mock).mock.calls.map((args: unknown[]) => args);
    const where = (call as { where: { createdAt: { lte: Date; lt?: Date; gte?: Date } } }).where;
    expect(where.createdAt.lte.toISOString()).toBe(new Date(now.getTime() - 3 * hour).toISOString());
    expect(where.createdAt.lt).toBeUndefined();
    expect(where.createdAt.gte).toBeUndefined();
  });
});
