import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { POST_FEEDBACK_REQUEST_KIND } from './post-feedback-message';
import { getReminderSettings } from './reminder-settings';

/** Asks an owner how posting their ad went (docs/plans/post-ad-experience-feedback.md), by default 48 hours after it went live (Admin →
 * Settings → Reminders sets the hours and switches it off). Sent as the same in-app "Bhavano Admin" message (and push) the Boost
 * messages use, with a Share feedback button that opens `/feedback/post/<id>`.
 *
 * Who gets it: the owner of a live ad who has not answered for it, who was never asked about it, and who has not been asked about any
 * of their ads in the last 30 days. Never within MIN_GAP_HOURS of another in-app message about the ad (the Boost follow-up uses the
 * same gap), at most one per owner per run, and only between 09:00 and 20:59 IST. An ad older than WINDOW_HOURS past its due time is
 * left alone: a request that comes days late after an outage is worse than none.
 *
 * On unless `POST_FEEDBACK_REQUEST_ENABLED=false`. */
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PER_RUN_CAP = 40;
const MIN_GAP_HOURS = 12;
const WINDOW_HOURS = 72;
const OWNER_COOLDOWN_DAYS = 30;
// Same literal as AdminService's own copy: the placeholder owner of bulk-imported ads, who is not a person to ask.
const BULK_IMPORT_OWNER_PHONE = '9000000002';

@Injectable()
export class PostFeedbackRequestJob {
  private readonly logger = new Logger(PostFeedbackRequestJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  @Cron('35 9-20 * * *', { timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    if (process.env.POST_FEEDBACK_REQUEST_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.sendRequests();
      if (sent > 0) this.logger.log(`Sent ${sent} post-feedback request(s)`);
    } catch (error) {
      this.logger.error('Post-feedback request job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** Exposed for a one-off run and for tests; returns how many requests went out. */
  async sendRequests(now = new Date()): Promise<number> {
    const settings = await getReminderSettings(this.prisma);
    if (!settings.feedbackRequestEnabled) return 0;

    const senderId = await this.resolveSenderId();
    if (!senderId) {
      this.logger.warn('No sending admin found (set BOOST_NUDGE_SENDER_USER_ID or create an admin user)');
      return 0;
    }

    const dueAfter = settings.feedbackRequestHours;
    const gapStart = new Date(now.getTime() - MIN_GAP_HOURS * HOUR_MS);
    const ownerSince = new Date(now.getTime() - OWNER_COOLDOWN_DAYS * DAY_MS);
    const candidates = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        publishState: 'live',
        moderationState: 'approved',
        expiresAt: { gt: now },
        createdAt: {
          gt: new Date(now.getTime() - (dueAfter + WINDOW_HOURS) * HOUR_MS),
          lte: new Date(now.getTime() - dueAfter * HOUR_MS),
        },
        owner: {
          role: 'user',
          phone: { not: BULK_IMPORT_OWNER_PHONE },
          // Nothing asked of this owner about any of their ads in the last 30 days.
          listings: { none: { notificationLogs: { some: { kind: POST_FEEDBACK_REQUEST_KIND, sentAt: { gte: ownerSince } } } } },
        },
        postFeedbacks: { none: {} },
        notificationLogs: {
          none: {
            OR: [{ kind: POST_FEEDBACK_REQUEST_KIND }, { channel: 'in_app', sentAt: { gte: gapStart } }],
          },
        },
      },
      select: { id: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
      take: PER_RUN_CAP * 2,
    });

    const seenOwners = new Set<string>();
    let sent = 0;
    for (const candidate of candidates) {
      if (sent >= PER_RUN_CAP) break;
      if (seenOwners.has(candidate.ownerId)) continue;
      seenOwners.add(candidate.ownerId);
      try {
        const ok = await this.adminService.sendPostFeedbackRequest(candidate.id, senderId);
        if (ok) {
          sent += 1;
        } else {
          // Not sendable (placeholder owner, ad gone): mark it done so it is not retried every hour.
          await this.prisma.listingNotificationLog.create({
            data: { listingId: candidate.id, kind: POST_FEEDBACK_REQUEST_KIND, channel: 'skipped' },
          });
        }
      } catch (error) {
        // A failed send is retried next hour.
        this.logger.warn(`Post-feedback request failed for ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return sent;
  }

  /** The admin the thread hangs off — never shown to the owner, who sees "Bhavano Admin". */
  private async resolveSenderId(): Promise<string | null> {
    const configured = process.env.BOOST_NUDGE_SENDER_USER_ID;
    if (configured) return configured;
    const admin = await this.prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    return admin?.id ?? null;
  }
}
