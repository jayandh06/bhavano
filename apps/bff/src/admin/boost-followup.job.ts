import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

/** Follows up on a non-Featured ad with the existing in-app Boost message, 4 hours, 1 day and 3 days after it went live — see
 * docs/plans/featured-expiry-reminder.md (section "Follow-ups after posting").
 *
 * It sends through `AdminService.sendBoostPromotion` (channel `in_app`), so the message, the card, the push, the live-ads-only /
 * not-already-featured / no-placeholder-owner rules and the price quoting are exactly the manual and automatic Boost message's. What
 * changes is the schedule: each stage is sent once per ad (a marker row, kind `boost_followup_4h|1d|3d`), the stages may follow one
 * another inside the 14-day cooldown (`skipCooldown`), and two messages for the same ad are never closer than MIN_GAP_HOURS.
 *
 * On unless `BOOST_FOLLOWUP_ENABLED=false`. Runs hourly 09:00–20:59 IST (a message at 3am is read as spam, and a stage that comes due
 * overnight goes out the next morning), at most one message per owner per run and PER_RUN_CAP overall. Supersedes the older
 * quiet-ad nudge (`BOOST_NUDGE_AUTO_ENABLED`, still off by default): leave that off or owners get both. */
const HOUR_MS = 60 * 60 * 1000;
const PER_RUN_CAP = 40;
const MIN_GAP_HOURS = 12;

interface Stage {
  kind: 'boost_followup_4h' | 'boost_followup_1d' | 'boost_followup_3d';
  /** The ad's age when the stage becomes due, and the age after which it is too late to send it (the next stage owns that time). */
  fromHours: number;
  toHours: number;
}

const STAGES: Stage[] = [
  { kind: 'boost_followup_4h', fromHours: 4, toHours: 20 },
  { kind: 'boost_followup_1d', fromHours: 24, toHours: 60 },
  { kind: 'boost_followup_3d', fromHours: 72, toHours: 120 },
];

@Injectable()
export class BoostFollowupJob {
  private readonly logger = new Logger(BoostFollowupJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  @Cron('5 9-20 * * *', { timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    if (process.env.BOOST_FOLLOWUP_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.sendFollowups();
      if (sent > 0) this.logger.log(`Sent ${sent} Boost follow-up message(s)`);
    } catch (error) {
      this.logger.error('Boost follow-up job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Exposed for a one-off run and for tests; returns how many messages went out. */
  async sendFollowups(now = new Date()): Promise<number> {
    const senderId = await this.resolveSenderId();
    if (!senderId) {
      this.logger.warn('No sending admin found (set BOOST_NUDGE_SENDER_USER_ID or create an admin user)');
      return 0;
    }

    const gapStart = new Date(now.getTime() - MIN_GAP_HOURS * HOUR_MS);
    const seenOwners = new Set<string>();
    let sent = 0;
    for (const stage of STAGES) {
      if (sent >= PER_RUN_CAP) break;
      const candidates = await this.prisma.listing.findMany({
        where: {
          status: 'active',
          publishState: 'live',
          moderationState: 'approved',
          expiresAt: { gt: now },
          createdAt: {
            gt: new Date(now.getTime() - stage.toHours * HOUR_MS),
            lte: new Date(now.getTime() - stage.fromHours * HOUR_MS),
          },
          OR: [{ boostedUntil: null }, { boostedUntil: { lte: now } }],
          owner: { role: 'user' },
          // This stage not sent yet, and nothing in-app about this ad inside the minimum gap.
          AND: [
            { notificationLogs: { none: { kind: stage.kind } } },
            { notificationLogs: { none: { kind: 'boost_promo', channel: 'in_app', sentAt: { gte: gapStart } } } },
          ],
        },
        select: { id: true, ownerId: true },
        orderBy: { createdAt: 'asc' },
        take: PER_RUN_CAP * 2,
      });

      for (const candidate of candidates) {
        if (sent >= PER_RUN_CAP) break;
        if (seenOwners.has(candidate.ownerId)) continue;
        seenOwners.add(candidate.ownerId);
        const result = await this.adminService.sendBoostPromotion([candidate.id], {
          channel: 'in_app',
          adminId: senderId,
          skipCooldown: true,
        });
        const error = result.results[0]?.error;
        // A failed send is retried next hour; every other refusal (already Featured, placeholder owner, ...) is final for this stage.
        if (result.sent === 0 && error === 'In-app message failed') continue;
        if (result.sent > 0) {
          sent += 1;
          await this.prisma.listingNotificationLog.create({
            data: { listingId: candidate.id, kind: stage.kind, channel: 'in_app' },
          });
        } else {
          // Not sendable (already featured, placeholder owner, ...): mark the stage done so it is not retried every hour.
          this.logger.debug(`Boost follow-up ${stage.kind} skipped for ${candidate.id}: ${error ?? 'unknown'}`);
          await this.prisma.listingNotificationLog.create({
            data: { listingId: candidate.id, kind: stage.kind, channel: 'skipped' },
          });
        }
      }
    }
    return sent;
  }

  /** The admin the thread hangs off — never shown to the owner, who sees "Bhavano Admin". */
  private async resolveSenderId(): Promise<string | null> {
    const configured = process.env.BOOST_NUDGE_SENDER_USER_ID;
    if (configured) return configured;
    const admin = await this.prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return admin?.id ?? null;
  }
}
