import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { OutreachCampaign, OutreachContact } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutreachService, renderTemplate } from './outreach.service';
import { OutreachSenderService } from './outreach-sender.service';

/**
 * Drives due campaigns. Same shape as ListingExpiryReminderJob — hourly @Cron in IST, a
 * re-entrancy guard, and per-contact try/catch so one bad number can't abort a whole run.
 *
 * Runs hourly rather than daily because a campaign's own `scheduledAt`/`cadenceCron` decides
 * when it actually fires; this tick just asks "is anything due?".
 */
@Injectable()
export class OutreachCampaignJob {
  private readonly logger = new Logger(OutreachCampaignJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outreach: OutreachService,
    private readonly sender: OutreachSenderService,
  ) {}

  @Cron('0 * * * *', { timeZone: 'Asia/Kolkata' })
  async runHourly(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.outreachCampaign.findMany({
        where: {
          status: { in: ['scheduled', 'running'] },
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        },
      });
      for (const campaign of due) {
        if (!this.isDue(campaign)) continue;
        await this.runCampaign(campaign);
      }
    } catch (error) {
      this.logger.error('Outreach campaign job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  /** A one-shot campaign (no cadence) fires once and is then marked completed; a recurring one
   * fires at most once per calendar day, which is what `runKey` encodes. */
  private isDue(campaign: OutreachCampaign): boolean {
    if (!campaign.lastRunAt) return true;
    if (!campaign.cadenceCron) return false;
    return this.runKey(campaign) !== this.runKey(campaign, campaign.lastRunAt);
  }

  private runKey(campaign: OutreachCampaign, at = new Date()): string {
    return campaign.cadenceCron ? at.toISOString().slice(0, 10) : 'once';
  }

  async runCampaign(campaign: OutreachCampaign): Promise<{ sent: number; failed: number; skipped: number }> {
    const runKey = this.runKey(campaign);
    const { contacts } = await this.outreach.resolveEligible(campaign);
    const needsPhone = campaign.channel !== 'email';

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const contact of contacts) {
      try {
        const outcome = await this.sendOne(campaign, contact, runKey, needsPhone);
        if (outcome === 'sent') sent++;
        else if (outcome === 'failed') failed++;
        else skipped++;
      } catch (error) {
        // A duplicate-key violation here means another run already claimed this contact — the
        // @@unique([campaignId, contactId, runKey]) constraint doing exactly its job.
        skipped++;
        this.logger.warn(
          `Campaign ${campaign.id} → contact ${contact.id} skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.prisma.outreachCampaign.update({
      where: { id: campaign.id },
      data: {
        lastRunAt: new Date(),
        ...(campaign.cadenceCron ? { status: 'running' } : { status: 'completed' }),
      },
    });

    this.logger.log(
      `Campaign "${campaign.name}" run ${runKey}: ${sent} sent, ${failed} failed, ${skipped} skipped` +
        (campaign.dryRun ? ' (DRY RUN — nothing actually delivered)' : ''),
    );
    return { sent, failed, skipped };
  }

  private async sendOne(
    campaign: OutreachCampaign,
    contact: OutreachContact,
    runKey: string,
    needsPhone: boolean,
  ): Promise<'sent' | 'failed' | 'skipped'> {
    const contactWithCity = await this.prisma.outreachContact.findUnique({
      where: { id: contact.id },
      include: { city: { select: { name: true } } },
    });
    const body = renderTemplate(campaign.bodyTemplate, contact, contactWithCity?.city?.name ?? null);
    const to = needsPhone ? contact.phoneE164 : contact.email;
    if (!to) return 'skipped';

    // Claim the slot first: the unique constraint makes this the point at which a concurrent or
    // retried run loses the race, so a crash after delivery can never double-send.
    const send = await this.prisma.campaignSend.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        channel: campaign.channel,
        runKey,
        renderedBody: body,
        status: 'queued',
      },
    });

    if (campaign.dryRun) {
      await this.prisma.campaignSend.update({
        where: { id: send.id },
        data: { status: 'suppressed', failureReason: 'dry run' },
      });
      return 'skipped';
    }

    const outcome = await this.sender.send(campaign.channel, to, body, campaign.dltTemplateId);

    if (!outcome.ok) {
      await this.prisma.campaignSend.update({
        where: { id: send.id },
        data: { status: 'failed', failureReason: outcome.error },
      });
      return 'failed';
    }

    await this.prisma.$transaction([
      this.prisma.campaignSend.update({
        where: { id: send.id },
        data: { status: 'sent', sentAt: new Date(), providerRef: outcome.providerRef ?? null },
      }),
      this.prisma.outreachContact.update({
        where: { id: contact.id },
        data: {
          lastContactedAt: new Date(),
          contactedCount: { increment: 1 },
          ...(contact.status === 'new' || contact.status === 'enriched' ? { status: 'contacted' } : {}),
        },
      }),
    ]);
    return 'sent';
  }
}
