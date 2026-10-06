import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** `expiresAt` is no longer a real deadline (see docs/plans/explicit-close-not-auto-expire.md —
 * nothing happens when it passes), but it's still exactly 30 days after the listing went live or
 * was last renewed, which makes it a convenient, already-computed "this listing just turned 30
 * days old" marker — reused here purely as a one-time nudge trigger, not as anything the listing
 * is actually counting down to. */
const REMINDER_KIND = 'listing_stale_reminder';

@Injectable()
export class ListingExpiryReminderJob {
  private readonly logger = new Logger(ListingExpiryReminderJob.name);
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
      this.logger.error('Listing stale reminder job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private async sendReminders(): Promise<void> {
    const now = new Date();
    // One-day window around "just turned 30 days old" — same width the old 7d/1d reminders each
    // used, just a single point instead of two. The notificationLogs dedup below (one kind, ever)
    // is what actually prevents re-sending, not the window's exact width.
    const windowStart = now;
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        publishState: 'live',
        moderationState: 'approved',
        expiresAt: { gte: windowStart, lt: windowEnd },
        notificationLogs: { none: { kind: REMINDER_KIND } },
      },
      include: {
        owner: { select: { email: true, phone: true, name: true } },
      },
    });

    for (const listing of listings) {
      try {
        const channel = await this.notifications.notifyListingExpiryReminder(listing.owner, listing.title);
        if (!channel) continue;
        await this.prisma.listingNotificationLog.create({
          data: { listingId: listing.id, kind: REMINDER_KIND, channel },
        });
      } catch (error) {
        this.logger.warn(
          `Failed stale-listing reminder for listing ${listing.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (listings.length > 0) {
      this.logger.log(`Sent ${REMINDER_KIND} reminders for ${listings.length} listing(s)`);
    }
  }
}
