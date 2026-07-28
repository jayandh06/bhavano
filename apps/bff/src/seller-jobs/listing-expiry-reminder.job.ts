import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const REMINDER_KINDS = [
  { kind: 'expiry_reminder_7d', daysAhead: 7 },
  { kind: 'expiry_reminder_1d', daysAhead: 1 },
] as const;

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
      for (const { kind, daysAhead } of REMINDER_KINDS) {
        await this.sendRemindersForOffset(kind, daysAhead);
      }
    } catch (error) {
      this.logger.error('Listing expiry reminder job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private async sendRemindersForOffset(kind: string, daysAhead: number): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        moderationState: 'approved',
        expiresAt: { gte: windowStart, lt: windowEnd },
        notificationLogs: { none: { kind } },
      },
      include: {
        owner: { select: { email: true, phone: true, name: true } },
      },
    });

    for (const listing of listings) {
      try {
        const channel = await this.notifications.notifyListingExpiryReminder(
          listing.owner,
          listing.title,
          listing.expiresAt,
          daysAhead,
        );
        if (!channel) continue;
        await this.prisma.listingNotificationLog.create({
          data: { listingId: listing.id, kind, channel },
        });
      } catch (error) {
        this.logger.warn(
          `Failed expiry reminder for listing ${listing.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (listings.length > 0) {
      this.logger.log(`Sent ${kind} reminders for ${listings.length} listing(s)`);
    }
  }
}
