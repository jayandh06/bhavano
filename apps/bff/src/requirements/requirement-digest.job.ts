import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** How many items the digest lists before it stops — the email is a prompt to go and look, not
 * the queue itself. */
const DIGEST_CAP = 25;

/**
 * Pushes the day's unmet demand to whoever runs the site — Phase 0 of
 * docs/plans/property-requirements-demand-side.md.
 *
 * The admin Requirements screen is a pull mechanism, and Phase 0's whole value is a human reading
 * it: at 1-3 captures a day a person can work all of them, search the catalogue by hand, call the
 * seeker, or point outreach at owners in that area. But the seeker has by then been told in
 * writing that someone will get back to them, so a queue that goes unread is a broken promise
 * rather than a missed opportunity. Hence a daily email instead of relying on the habit.
 *
 * Silent when there is nothing new — a digest that arrives every day regardless is a digest
 * people stop opening, and then this job might as well not exist.
 */
@Injectable()
export class RequirementDigestJob {
  private readonly logger = new Logger(RequirementDigestJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 09:00 IST, alongside the listing-expiry reminder — the start of a working day, so the list
   * is actionable the moment it arrives. */
  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async runDaily(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendDigest();
    } catch (error) {
      this.logger.error('Requirement digest job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private async sendDigest(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [fresh, openTotal, admins] = await Promise.all([
      this.prisma.requirement.findMany({
        where: { createdAt: { gte: since } },
        include: { city: true, area: true, seeker: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: DIGEST_CAP,
      }),
      this.prisma.requirement.count({ where: { status: 'open' } }),
      // Whoever is an admin right now, rather than a hardcoded address — one less thing to
      // remember when that changes. Admins without an email are skipped by the send itself.
      this.prisma.user.findMany({
        where: { role: 'admin', email: { not: null } },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);

    if (fresh.length === 0) {
      this.logger.log(`No new requirements in the last 24h — digest skipped (${openTotal} still open)`);
      return;
    }
    if (admins.length === 0) {
      this.logger.warn(`${fresh.length} new requirement(s) but no admin has an email address on file`);
      return;
    }

    const lines = fresh.map((row) => {
      const where = row.area?.name ?? row.city?.name ?? 'anywhere';
      const who = row.seeker.name ?? row.seeker.phone ?? 'someone';
      const alert = row.savedSearchId ? '' : ' [no alert — manual only]';
      return `${row.searchLabel} — ${where}, for ${who}${alert}`;
    });

    for (const admin of admins) {
      const channel = await this.notifications
        .notifyRequirementDigest(admin, lines, openTotal)
        .catch((error: unknown) => {
          this.logger.error(`Requirement digest to ${admin.id} failed: ${String(error)}`);
          return null;
        });
      if (channel) this.logger.log(`Requirement digest sent to ${admin.id} via ${channel}`);
    }
  }
}
