import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** N days after posting is when most owners have stopped checking back on their own —
 * `boost-nudge.job.ts` picks 24-72h on "most ads get only a couple of views in their first
 * week"; this fires a bit later since it's a return-visit nudge, not a Boost upsell at the
 * moment of posting. Tune by changing this one constant. */
const REMINDER_DAYS = 3;
const REMINDER_KIND = 'listing_posted_reminder';

@Injectable()
export class ListingPostedReminderJob {
  private readonly logger = new Logger(ListingPostedReminderJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async runDaily(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendReminders();
    } catch (error) {
      this.logger.error(
        'Listing posted reminder job failed',
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
      now.getTime() - REMINDER_DAYS * 24 * 60 * 60 * 1000,
    );
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        publishState: 'live',
        moderationState: 'approved',
        createdAt: { gte: windowStart, lt: windowEnd },
        notificationLogs: { none: { kind: REMINDER_KIND } },
      },
      include: {
        owner: { select: { id: true, email: true, phone: true, name: true } },
      },
    });

    for (const listing of listings) {
      try {
        const isBoosted =
          (listing.boostedUntil?.getTime() ?? 0) > now.getTime();
        const channel = await this.notifications.notifyListingPostedReminder(
          listing.owner.id,
          listing.owner,
          listing.title,
          isBoosted,
        );
        if (!channel) continue;
        await this.prisma.listingNotificationLog.create({
          data: { listingId: listing.id, kind: REMINDER_KIND, channel },
        });
      } catch (error) {
        this.logger.warn(
          `Failed posted-reminder for listing ${listing.id}: ${error instanceof Error ? error.message : error}`,
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
