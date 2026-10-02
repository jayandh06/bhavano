import { ReferralCreditExpiryReminderJob } from './referral-credit-expiry-reminder.job';
import type { ReferralNotificationsService } from './referral-notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ReferralCreditExpiryReminderJob', () => {
  const now = new Date('2026-10-02T04:30:00Z');
  const day = 86_400_000;

  function makeJob(credits: { id: string; userId: string; daysGranted: number; expiresAt: Date }[]) {
    const prisma = {
      referralCreditBatch: {
        findMany: jest.fn().mockResolvedValue(credits),
        updateMany: jest.fn().mockResolvedValue({ count: credits.length }),
      },
    };
    const notifier = { creditExpiring: jest.fn().mockResolvedValue(true) };
    const job = new ReferralCreditExpiryReminderJob(
      prisma as unknown as PrismaService,
      notifier as unknown as ReferralNotificationsService,
    );
    return { job, prisma, notifier };
  }

  it('looks only at unspent, unreminded credits expiring within the next 7 days', async () => {
    const { job, prisma } = makeJob([]);
    await job.sendReminders(now);
    expect(prisma.referralCreditBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          redeemedAt: null,
          revokedAt: null,
          expiryReminderSentAt: null,
          expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * day) },
        },
      }),
    );
  });

  it('sends one reminder per user, about the soonest credit, and marks all of them reminded', async () => {
    const soon = new Date(now.getTime() + 2 * day);
    const later = new Date(now.getTime() + 5 * day);
    const { job, prisma, notifier } = makeJob([
      { id: 'c1', userId: 'u1', daysGranted: 3, expiresAt: soon },
      { id: 'c2', userId: 'u2', daysGranted: 3, expiresAt: soon },
      { id: 'c3', userId: 'u1', daysGranted: 3, expiresAt: later },
    ]);
    expect(await job.sendReminders(now)).toBe(2);
    expect(notifier.creditExpiring).toHaveBeenCalledTimes(2);
    expect(notifier.creditExpiring).toHaveBeenCalledWith('u1', 3, soon);
    expect(prisma.referralCreditBatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c3'] } },
      data: { expiryReminderSentAt: now },
    });
  });
});
