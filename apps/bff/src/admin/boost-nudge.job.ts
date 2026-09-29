import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

/** Automatic Boost nudge for a quiet ad — see docs/plans/admin-in-app-boost-message.md.
 *
 * The moment to sell a boost after the first ten minutes is when the seller has seen for
 * themselves that nobody is looking: most ads get only a couple of views in their first week.
 * This finds live, unboosted ads that are 1–3 days old with almost no views and sends the owner
 * the same in-app "Bhavano Admin" message the Listings page sends by hand, through the same
 * `AdminService.sendBoostPromotion` — so every skip rule and the 14-day cooldown apply unchanged.
 *
 * **Off unless `BOOST_NUDGE_AUTO_ENABLED=true`.** It sends real messages to real sellers, so it is
 * an explicit switch, not a default. Bounded three ways so a bug or a busy day cannot flood the
 * inbox: a per-run cap, daytime hours only, and at most one message per owner (an owner with three
 * ads gets one nudge, not three, and none if any of their ads was messaged recently). */
const MIN_AGE_HOURS = 24;
const MAX_AGE_HOURS = 72;
/** "Almost no views": the average unboosted ad gets ~1.6 in its first week. */
const MAX_VIEWS = 2;
const PER_RUN_CAP = 25;
const COOLDOWN_DAYS = 14;

@Injectable()
export class BoostNudgeJob {
  private readonly logger = new Logger(BoostNudgeJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  /** Hourly at :15, 10:00–19:59 IST — a message that lands at 3am is read as spam, and a push at
   * that hour is worse. */
  @Cron('15 10-19 * * *', { timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    if (process.env.BOOST_NUDGE_AUTO_ENABLED !== 'true') return;
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.nudgeQuietListings();
      if (sent > 0) this.logger.log(`Sent ${sent} automatic boost message(s)`);
    } catch (error) {
      this.logger.error('Boost nudge job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Exposed for a one-off run and for tests; returns how many messages went out. */
  async nudgeQuietListings(now = new Date()): Promise<number> {
    const senderId = await this.resolveSenderId();
    if (!senderId) {
      this.logger.warn('No sending admin found (set BOOST_NUDGE_SENDER_USER_ID or create an admin user)');
      return 0;
    }

    const hour = 60 * 60 * 1000;
    const cooldownStart = new Date(now.getTime() - COOLDOWN_DAYS * 24 * hour);
    const candidates = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        publishState: 'live',
        moderationState: 'approved',
        expiresAt: { gt: now },
        createdAt: {
          gte: new Date(now.getTime() - MAX_AGE_HOURS * hour),
          lte: new Date(now.getTime() - MIN_AGE_HOURS * hour),
        },
        OR: [{ boostedUntil: null }, { boostedUntil: { lte: now } }],
        // Never ever nudged in-app for this ad, and no other ad of the same owner nudged recently.
        notificationLogs: { none: { kind: 'boost_promo', channel: 'in_app' } },
        owner: {
          role: 'user',
          listings: {
            none: {
              notificationLogs: { some: { kind: 'boost_promo', channel: 'in_app', sentAt: { gte: cooldownStart } } },
            },
          },
        },
      },
      select: { id: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
      take: PER_RUN_CAP * 4,
    });
    if (candidates.length === 0) return 0;

    const viewCounts = await this.prisma.listingView.groupBy({
      by: ['listingId'],
      where: { listingId: { in: candidates.map((c) => c.id) } },
      _count: { _all: true },
    });
    const views = new Map(viewCounts.map((row) => [row.listingId, row._count._all]));

    // One per owner, and only the quiet ones.
    const seenOwners = new Set<string>();
    const chosen: string[] = [];
    for (const c of candidates) {
      if ((views.get(c.id) ?? 0) > MAX_VIEWS) continue;
      if (seenOwners.has(c.ownerId)) continue;
      seenOwners.add(c.ownerId);
      chosen.push(c.id);
      if (chosen.length >= PER_RUN_CAP) break;
    }
    if (chosen.length === 0) return 0;

    const result = await this.adminService.sendBoostPromotion(chosen, { channel: 'in_app', adminId: senderId });
    if (result.failed > 0) {
      this.logger.warn(
        `${result.failed} of ${chosen.length} automatic boost messages were skipped or failed: ` +
          result.results
            .filter((r) => !r.success)
            .map((r) => `${r.listingId} (${r.error})`)
            .join(', '),
      );
    }
    return result.sent;
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
