import { ListingPostedReminderJob } from './listing-posted-reminder.job';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ListingPostedReminderJob', () => {
  const now = new Date('2026-10-10T03:30:00Z');
  const day = 86_400_000;
  const REMINDER_DAYS = 3;

  function stubListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 'listing1',
      title: 'Nice flat',
      boostedUntil: null,
      createdAt: new Date(now.getTime() - REMINDER_DAYS * day),
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
      notifyListingPostedReminder: jest.fn().mockResolvedValue('email'),
    };
    const job = new ListingPostedReminderJob(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    return { job, prisma, notifications };
  }

  it('looks only at live, approved listings posted exactly REMINDER_DAYS ago with no existing reminder log', async () => {
    const { job, prisma } = makeJob([]);
    await job.sendReminders(now);
    const windowStart = new Date(now.getTime() - REMINDER_DAYS * day);
    const windowEnd = new Date(windowStart.getTime() + day);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'active',
          publishState: 'live',
          moderationState: 'approved',
          createdAt: { gte: windowStart, lt: windowEnd },
          notificationLogs: { none: { kind: 'listing_posted_reminder' } },
        },
      }),
    );
  });

  it('computes isBoosted from boostedUntil and passes it through for an unboosted listing', async () => {
    const { job, notifications, prisma } = makeJob([
      stubListing({ boostedUntil: null }),
    ]);
    await job.sendReminders(now);
    expect(notifications.notifyListingPostedReminder).toHaveBeenCalledWith(
      'owner1',
      expect.objectContaining({ id: 'owner1' }),
      'Nice flat',
      false,
    );
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'listing1',
        kind: 'listing_posted_reminder',
        channel: 'email',
      },
    });
  });

  it('computes isBoosted true for a listing with boostedUntil in the future', async () => {
    const { job, notifications } = makeJob([
      stubListing({ boostedUntil: new Date(now.getTime() + day) }),
    ]);
    await job.sendReminders(now);
    expect(notifications.notifyListingPostedReminder).toHaveBeenCalledWith(
      'owner1',
      expect.anything(),
      'Nice flat',
      true,
    );
  });

  it('does not write a log row when the notification channel is null', async () => {
    const { job, prisma, notifications } = makeJob([stubListing()]);
    notifications.notifyListingPostedReminder.mockResolvedValue(null);
    await job.sendReminders(now);
    expect(prisma.listingNotificationLog.create).not.toHaveBeenCalled();
  });

  it('continues to the next listing if one throws', async () => {
    const { job, prisma, notifications } = makeJob([
      stubListing({ id: 'bad' }),
      stubListing({ id: 'good' }),
    ]);
    notifications.notifyListingPostedReminder
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('whatsapp');
    await job.sendReminders(now);
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'good',
        kind: 'listing_posted_reminder',
        channel: 'whatsapp',
      },
    });
  });
});
