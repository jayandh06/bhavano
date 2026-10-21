import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isBulkImportOwner } from './bulk-import-owner';
import { getPostedConfirmationDelayMinutes } from './posted-confirmation-settings';

const POSTED_KIND = 'posted';
/** How far back the sweep looks, so a first run never mails old listings. */
const SWEEP_WINDOW_HOURS = 6;

/** The "your ad is posted" email / WhatsApp, held back until the seller has been through the
 * Featured offer. The wizard releases it when the live screen is reached (paid, skipped or the
 * payment window closed); if they never get there, the sweep sends it once the delay has passed.
 * The delay is an admin setting (Settings → Posted confirmation; default 60, 0 sends at post time).
 * See docs/plans/post-first-featured-upsell.md. */
@Injectable()
export class PostedConfirmationService {
  private readonly logger = new Logger(PostedConfirmationService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Sends the confirmation unless it was already sent. True when a message went out. */
  async send(listingId: string): Promise<boolean> {
    if (this.inFlight.has(listingId)) return false;
    this.inFlight.add(listingId);
    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          city: true,
          area: true,
          owner: { select: { email: true, phone: true, name: true } },
          notificationLogs: { where: { kind: POSTED_KIND }, take: 1 },
        },
      });
      if (!listing || listing.notificationLogs.length > 0) return false;
      if (listing.publishState !== 'live' || listing.moderationState !== 'approved') return false;
      if (!listing.owner || isBulkImportOwner(listing.owner)) return false;

      const result = await this.notifications.notifyListingPosted(
        listing.owner,
        {
          id: listing.id,
          slug: listing.slug,
          category: listing.category,
          transactionType: listing.transactionType,
          cityName: listing.city.name,
          area: listing.area.name,
          title: listing.title,
        },
        listing.ownerId,
      );
      if (!result) return false;
      await this.prisma.listingNotificationLog.create({
        data: {
          listingId: listing.id,
          kind: POSTED_KIND,
          channel: result.channel,
          providerMessageId: result.messageId ?? null,
        },
      });
      return true;
    } finally {
      this.inFlight.delete(listingId);
    }
  }

  /** The wizard reached the live screen. Only the ad's own owner may release it. */
  async release(listingId: string, userId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId !== userId) throw new ForbiddenException();
    await this.send(listingId);
  }

  /** Sends what is still unsent once the delay has passed. Browser/app posts only (they carry a
   * session id), and only recent ones, so it never mails a backlog. */
  async sendDue(now: Date = new Date()): Promise<number> {
    const delayMs = (await getPostedConfirmationDelayMinutes(this.prisma)) * 60_000;
    const due = await this.prisma.listing.findMany({
      where: {
        publishState: 'live',
        moderationState: 'approved',
        createSessionId: { not: null },
        publishedAt: {
          gte: new Date(now.getTime() - SWEEP_WINDOW_HOURS * 3_600_000),
          lte: new Date(now.getTime() - delayMs),
        },
        notificationLogs: { none: { kind: POSTED_KIND } },
      },
      select: { id: true },
      take: 100,
    });
    let sent = 0;
    for (const { id } of due) {
      try {
        if (await this.send(id)) sent += 1;
      } catch (error) {
        this.logger.error(`Posted confirmation failed for ${id}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return sent;
  }
}
