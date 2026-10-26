import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { getReminderSettings } from './reminder-settings';

/** Tells a seller their Featured period is ending, by default 3 days and 1 day before (Admin → Settings → Reminders sets the days and
 * switches it off) — see docs/plans/featured-expiry-reminder.md.
 *
 * Sent as the same in-app "Bhavano Admin" message (and push) the Boost offer uses, with a Renew button. Unlike the quiet-ad nudge this
 * is about something the seller already paid for, so it is **on unless `FEATURED_EXPIRY_REMINDER_ENABLED=false`**. Runs once a day at
 * 10:00 IST (a push at night reads as spam). Each reminder goes out at most once per Feature period: the log row is compared with the
 * start of the latest period, so a seller who renews is reminded again next time. */
const DAY_MS = 24 * 60 * 60 * 1000;
const PER_RUN_CAP = 300;

interface Stage {
  daysLeft: number;
  kind: string;
  /** `boostedUntil` must lie in (from, to] days from now. Strict windows so "in 3 days" is never sent at 2 days. */
  fromDays: number;
  toDays: number;
}

/** One stage per configured day: 3 means the Feature period ends 2 to 3 days from now. */
export function expiryStages(days: number[]): Stage[] {
  return days.map((d) => ({ daysLeft: d, kind: `featured_expiry_${d}d`, fromDays: d - 1, toDays: d }));
}

@Injectable()
export class FeaturedExpiryReminderJob {
  private readonly logger = new Logger(FeaturedExpiryReminderJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  @Cron('0 10 * * *', { timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    if (process.env.FEATURED_EXPIRY_REMINDER_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.sendReminders();
      if (sent > 0) this.logger.log(`Sent ${sent} Featured-expiry reminder(s)`);
    } catch (error) {
      this.logger.error('Featured expiry reminder job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Exposed for a one-off run and for tests; returns how many reminders went out. */
  async sendReminders(now = new Date()): Promise<number> {
    const senderId = await this.resolveSenderId();
    if (!senderId) {
      this.logger.warn('No sending admin found (set BOOST_NUDGE_SENDER_USER_ID or create an admin user)');
      return 0;
    }

    const settings = await getReminderSettings(this.prisma);
    if (!settings.featuredExpiryEnabled) return 0;

    let sent = 0;
    for (const stage of expiryStages(settings.featuredExpiryDays)) {
      const candidates = await this.prisma.listing.findMany({
        where: {
          status: 'active',
          publishState: 'live',
          moderationState: 'approved',
          boostedUntil: {
            gt: new Date(now.getTime() + stage.fromDays * DAY_MS),
            lte: new Date(now.getTime() + stage.toDays * DAY_MS),
          },
          owner: { role: 'user' },
        },
        select: {
          id: true,
          boostedUntil: true,
          // The latest Feature period's start: a reminder already sent since then is not sent again.
          listingBoosts: { orderBy: { boostedFrom: 'desc' }, take: 1, select: { boostedFrom: true } },
          notificationLogs: {
            where: { kind: stage.kind, channel: 'in_app' },
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { sentAt: true },
          },
        },
        take: PER_RUN_CAP,
      });

      for (const listing of candidates) {
        if (sent >= PER_RUN_CAP) return sent;
        const periodStart = listing.listingBoosts[0]?.boostedFrom ?? null;
        const lastSent = listing.notificationLogs[0]?.sentAt ?? null;
        // No Feature row (set by an admin by hand): fall back to "not within the last 5 days".
        if (lastSent && (periodStart ? lastSent >= periodStart : now.getTime() - lastSent.getTime() < 5 * DAY_MS)) continue;
        // A Feature period no longer than the stage's days would get that reminder on its first day.
        if (periodStart && listing.boostedUntil && listing.boostedUntil.getTime() - periodStart.getTime() <= stage.daysLeft * DAY_MS) {
          continue;
        }
        try {
          if (await this.adminService.sendFeaturedExpiryReminder(listing.id, stage.daysLeft, senderId)) sent += 1;
        } catch (error) {
          this.logger.warn(
            `Featured expiry reminder failed for listing ${listing.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
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
