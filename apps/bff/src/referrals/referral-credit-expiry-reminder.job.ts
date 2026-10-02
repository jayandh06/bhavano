import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralNotificationsService } from './referral-notifications.service';

const REMIND_DAYS_AHEAD = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "Your free boost expires on <date>" — 7 days ahead, per the requirements doc's notification
 * table. Everything expiring within the next 7 days that hasn't been reminded yet is picked up,
 * not just a one-day slice, so a missed run or a credit granted with a short expiry still gets
 * its one reminder. A user with several such credits gets one message, about the soonest. */
@Injectable()
export class ReferralCreditExpiryReminderJob {
  private readonly logger = new Logger(ReferralCreditExpiryReminderJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: ReferralNotificationsService,
  ) {}

  @Cron('0 10 * * *', { timeZone: 'Asia/Kolkata' })
  async runDaily(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendReminders();
    } catch (error) {
      this.logger.error('Referral credit expiry reminder job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  async sendReminders(now = new Date()): Promise<number> {
    const credits = await this.prisma.referralCreditBatch.findMany({
      where: {
        redeemedAt: null,
        revokedAt: null,
        expiryReminderSentAt: null,
        expiresAt: { gt: now, lte: new Date(now.getTime() + REMIND_DAYS_AHEAD * DAY_MS) },
      },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, userId: true, daysGranted: true, expiresAt: true },
    });

    const byUser = new Map<string, typeof credits>();
    for (const c of credits) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c]);

    for (const [userId, userCredits] of byUser) {
      const soonest = userCredits[0];
      await this.notifier.creditExpiring(userId, soonest.daysGranted, soonest.expiresAt);
      // Marked even when nothing was delivered (no email, no app installed): retrying daily would
      // not change that, and the credit stays visible on the Referrals page either way.
      await this.prisma.referralCreditBatch.updateMany({
        where: { id: { in: userCredits.map((c) => c.id) } },
        data: { expiryReminderSentAt: now },
      });
    }

    if (byUser.size > 0) this.logger.log(`Sent referral credit expiry reminders to ${byUser.size} user(s)`);
    return byUser.size;
  }
}
