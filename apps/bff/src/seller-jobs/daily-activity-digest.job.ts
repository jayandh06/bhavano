import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const DIGEST_KIND = 'daily_activity_digest';

@Injectable()
export class DailyActivityDigestJob {
  private readonly logger = new Logger(DailyActivityDigestJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** A different hour from the existing 9am jobs, spreading cron load rather than batching
   * everything at once. */
  @Cron('0 8 * * *', { timeZone: 'Asia/Kolkata' })
  async runDaily(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendDigests();
    } catch (error) {
      this.logger.error(
        'Daily activity digest job failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  /** `now` is a parameter so a manual test run can exercise a specific window without faking the
   * system clock. A fixed trailing-24h window, run once daily, is simpler than tracking a
   * per-user "last digest sent at" and self-corrects if a run is ever missed — next day's window
   * just starts from "yesterday" again. */
  async sendDigests(now: Date = new Date()): Promise<number> {
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Same-day dedup: a manual re-run on the same day must not double-send. The trailing-24h
    // window alone isn't enough protection for that (it would just recompute the same counts).
    const alreadySent = await this.prisma.userNotificationLog.findMany({
      where: { kind: DIGEST_KIND, sentAt: { gte: dayStart } },
      select: { userId: true },
    });
    const alreadySentIds = new Set(alreadySent.map((r) => r.userId));

    const listings = await this.prisma.listing.findMany({
      where: { status: 'active', publishState: 'live' },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, email: true, phone: true, name: true } },
      },
    });
    if (listings.length === 0) return 0;

    const listingIds = listings.map((l) => l.id);
    const ownerByListingId = new Map(listings.map((l) => [l.id, l.owner]));
    const listingIdsByOwner = new Map<string, string[]>();
    for (const l of listings) {
      const ids = listingIdsByOwner.get(l.ownerId) ?? [];
      ids.push(l.id);
      listingIdsByOwner.set(l.ownerId, ids);
    }

    // Bounded batch + in-memory aggregation, same pattern listPerformanceForAdmin already uses
    // for the same "Message has no listingId, Conversation/ListingView don't roll up to owner
    // directly" shape - never a per-owner query in a loop.
    const [views, favourites, conversations] = await Promise.all([
      this.prisma.listingView.groupBy({
        by: ['listingId'],
        where: {
          listingId: { in: listingIds },
          createdAt: { gte: windowStart, lt: now },
        },
        _count: { _all: true },
      }),
      this.prisma.favourite.groupBy({
        by: ['listingId'],
        where: {
          listingId: { in: listingIds },
          createdAt: { gte: windowStart, lt: now },
        },
        _count: { _all: true },
      }),
      this.prisma.conversation.findMany({
        where: { listingId: { in: listingIds }, type: 'inquiry' },
        select: { id: true, listingId: true, posterId: true },
      }),
    ]);

    const conversationIds = conversations.map((c) => c.id);
    const messages = conversationIds.length
      ? await this.prisma.message.findMany({
          where: {
            conversationId: { in: conversationIds },
            createdAt: { gte: windowStart, lt: now },
          },
          select: { conversationId: true, senderId: true },
        })
      : [];
    const convById = new Map(conversations.map((c) => [c.id, c]));

    const viewsByOwner = new Map<string, number>();
    for (const v of views) {
      const ownerId = ownerByListingId.get(v.listingId)?.id;
      if (!ownerId) continue;
      viewsByOwner.set(
        ownerId,
        (viewsByOwner.get(ownerId) ?? 0) + v._count._all,
      );
    }
    const favouritesByOwner = new Map<string, number>();
    for (const f of favourites) {
      const ownerId = ownerByListingId.get(f.listingId)?.id;
      if (!ownerId) continue;
      favouritesByOwner.set(
        ownerId,
        (favouritesByOwner.get(ownerId) ?? 0) + f._count._all,
      );
    }
    // "Received" messages only - someone messaging the owner, not the owner's own replies.
    const messagesByOwner = new Map<string, number>();
    for (const m of messages) {
      const conv = convById.get(m.conversationId);
      if (!conv || m.senderId === conv.posterId) continue;
      messagesByOwner.set(
        conv.posterId,
        (messagesByOwner.get(conv.posterId) ?? 0) + 1,
      );
    }

    let sent = 0;
    for (const [ownerId, listingIdsForOwner] of listingIdsByOwner) {
      if (alreadySentIds.has(ownerId)) continue;
      const counts = {
        views: viewsByOwner.get(ownerId) ?? 0,
        favourites: favouritesByOwner.get(ownerId) ?? 0,
        messages: messagesByOwner.get(ownerId) ?? 0,
      };
      if (
        counts.views === 0 &&
        counts.favourites === 0 &&
        counts.messages === 0
      )
        continue;

      const owner = ownerByListingId.get(listingIdsForOwner[0]);
      if (!owner) continue;

      try {
        const channel = await this.notifications.notifyDailyActivityDigest(
          ownerId,
          owner,
          counts,
        );
        if (!channel) continue;
        await this.prisma.userNotificationLog.create({
          data: { userId: ownerId, kind: DIGEST_KIND, channel },
        });
        sent += 1;
      } catch (error) {
        this.logger.warn(
          `Failed daily activity digest for owner ${ownerId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (sent > 0) {
      this.logger.log(`Sent ${DIGEST_KIND} to ${sent} owner(s)`);
    }
    return sent;
  }
}
