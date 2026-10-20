import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { isQuickResponder, QUICK_RESPONDER } from '@bhavano/types/quickResponder';
import { PrismaService } from '../prisma/prisma.service';
import { setQuickResponderOwners } from './quick-responder.store';

const REFRESH_MS = 6 * 60 * 60 * 1000;

interface OwnerReplyRow {
  ownerId: string;
  enquiries: number;
  quick: number;
}

/** Recomputes which owners earn the "Quick responder" badge (see QUICK_RESPONDER for the rule) from
 * the last 90 days of enquiry conversations: per conversation, the buyer's first message to the
 * owner's first later reply. One grouped read per refresh; nothing is stored in the database. */
@Injectable()
export class QuickResponderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuickResponderService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    // Not awaited: boot must never wait on (or fail because of) a stats query.
    void this.refresh();
  }

  @Interval(REFRESH_MS)
  async refresh(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.$queryRaw<OwnerReplyRow[]>`
        WITH first_buyer AS (
          SELECT c.id AS cid, c."posterId" AS poster, MIN(m."createdAt") AS bt
          FROM "Conversation" c
          JOIN "Message" m ON m."conversationId" = c.id AND m."senderId" <> c."posterId" AND m."deletedAt" IS NULL
          WHERE c.type = 'inquiry' AND c."createdAt" > now() - make_interval(days => ${QUICK_RESPONDER.windowDays}::int)
          GROUP BY c.id, c."posterId"
        ), replies AS (
          SELECT fb.cid, fb.poster, fb.bt, MIN(m."createdAt") AS rt
          FROM first_buyer fb
          LEFT JOIN "Message" m ON m."conversationId" = fb.cid AND m."senderId" = fb.poster
            AND m."createdAt" > fb.bt AND m."deletedAt" IS NULL
          GROUP BY fb.cid, fb.poster, fb.bt
        )
        SELECT poster AS "ownerId",
               COUNT(*)::int AS enquiries,
               (COUNT(*) FILTER (
                 WHERE rt IS NOT NULL AND rt - bt <= make_interval(mins => ${QUICK_RESPONDER.replyWithinMinutes}::int)
               ))::int AS quick
        FROM replies
        GROUP BY poster
        HAVING COUNT(*) >= ${QUICK_RESPONDER.minEnquiries}::int
      `;
      const ids = rows.filter((r) => isQuickResponder(r.enquiries, r.quick)).map((r) => r.ownerId);
      setQuickResponderOwners(ids);
      this.logger.log(`Quick responder refreshed: ${ids.length} of ${rows.length} qualifying-volume owners`);
    } catch (error) {
      // Keep the previous set: a failed refresh must not strip every badge.
      this.logger.error('Quick responder refresh failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
