import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** A `pending_checkout` listing has no expiry (see docs/plans/
 * pending-checkout-payment-reminder.md) — nothing else ever tells the owner it's waiting unless
 * they happen to come back on their own. 3h, not a day, because this is a same-day
 * cart-abandonment nudge: intent is highest soon after leaving, unlike `ListingPostedReminderJob`'s
 * later return-visit nudge for an ad that's already live. Hourly cron (not daily, like the other
 * seller-jobs) so a listing is caught within an hour of crossing the 3h mark, regardless of what
 * time of day it was created.
 *
 * Deliberately open-ended (`createdAt <= now - 3h`, no upper bound) rather than a closed 3-4h
 * band — a closed band gives each listing exactly one eligible hourly run ever; miss that one
 * run (the container was mid-deploy, a DB hiccup, anything) and every later run's window has
 * already moved past it, so it silently never gets reminded at all. The dedup check below
 * (`notificationLogs: none`) is what actually prevents a double-send, so the window doesn't need
 * to — self-heals instead: any still-pending, never-notified listing is caught on the very next
 * run no matter how long it's been stuck. */
const MIN_AGE_HOURS = 3;
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
    const cutoff = new Date(now.getTime() - MIN_AGE_HOURS * 60 * 60 * 1000);

    const listings = await this.prisma.listing.findMany({
      where: {
        // Current state, not a snapshot — a listing paid for in the meantime is naturally
        // excluded without this job needing to know anything about Payment rows.
        publishState: 'pending_checkout',
        // Open-ended, not also `lt` some upper bound — see MIN_AGE_HOURS's own comment on why
        // the dedup check below is what prevents a double-send, not this filter.
        createdAt: { lte: cutoff },
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
