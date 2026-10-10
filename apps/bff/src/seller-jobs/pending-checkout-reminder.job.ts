import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** A `pending_checkout` listing has no expiry (see docs/plans/
 * pending-checkout-payment-reminder.md) — nothing else ever tells the owner it's waiting unless
 * they happen to come back on their own. 3-4h, not a day, because this is a same-day
 * cart-abandonment nudge: intent is highest soon after leaving, unlike `ListingPostedReminderJob`'s
 * later return-visit nudge for an ad that's already live. Hourly cron (not daily, like the other
 * seller-jobs) so a ~1h-wide window is checked often enough to land reliably within it regardless
 * of what time of day the listing was created. */
const WINDOW_START_HOURS = 4;
const WINDOW_END_HOURS = 3;
const REMINDER_KIND = 'pending_checkout_reminder';

@Injectable()
export class PendingCheckoutReminderJob {
  private readonly logger = new Logger(PendingCheckoutReminderJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 20 minutes past the hour — `outreach-campaign.job.ts` already owns the top of the hour. */
  @Cron('20 * * * *', { timeZone: 'Asia/Kolkata' })
  async runHourly(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendReminders();
    } catch (error) {
      this.logger.error(
        'Pending checkout reminder job failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  /** `now` is a parameter (not `new Date()` inline) so a manual test run can land exactly in the
   * window for one specific listing without faking the system clock or its `createdAt`. */
  async sendReminders(now: Date = new Date()): Promise<void> {
    const windowStart = new Date(
      now.getTime() - WINDOW_START_HOURS * 60 * 60 * 1000,
    );
    const windowEnd = new Date(
      now.getTime() - WINDOW_END_HOURS * 60 * 60 * 1000,
    );

    const listings = await this.prisma.listing.findMany({
      where: {
        // Current state, not a snapshot — a listing paid for in the meantime is naturally
        // excluded without this job needing to know anything about Payment rows.
        publishState: 'pending_checkout',
        createdAt: { gte: windowStart, lt: windowEnd },
        notificationLogs: { none: { kind: REMINDER_KIND } },
      },
      include: {
        owner: { select: { id: true, email: true, phone: true, name: true } },
      },
    });

    for (const listing of listings) {
      try {
        const channel = await this.notifications.notifyPendingCheckoutReminder(
          listing.owner.id,
          listing.owner,
          listing.title,
          listing.id,
        );
        if (!channel) continue;
        await this.prisma.listingNotificationLog.create({
          data: { listingId: listing.id, kind: REMINDER_KIND, channel },
        });
      } catch (error) {
        this.logger.warn(
          `Failed pending-checkout reminder for listing ${listing.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (listings.length > 0) {
      this.logger.log(
        `Sent ${REMINDER_KIND} reminders for ${listings.length} listing(s)`,
      );
    }
  }
}
