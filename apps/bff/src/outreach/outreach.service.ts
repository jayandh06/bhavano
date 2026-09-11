import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { OutreachContact, OutreachCampaign } from '@prisma/client';
import type {
  CampaignAudienceFilter,
  CampaignPreviewDto,
  CampaignSendDto,
  CampaignSendsPage,
  ClaimSource,
  CreateOutreachCampaignInput,
  CreateOutreachContactInput,
  ImportOutreachContactsInput,
  ImportOutreachContactsResult,
  OutreachCampaignDto,
  OutreachCampaignsPage,
  OutreachContactDto,
  OutreachContactsPage,
  SendStatus,
  UpdateOutreachCampaignInput,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { Msg91Provider } from '../notifications/providers/msg91.provider';
import { EmailProvider } from '../notifications/providers/email.provider';
import { renderEmail } from '../notifications/emailLayout';
import { loadTemplate, renderTemplate as renderEmailTemplate } from '../notifications/templateLoader';
import { toE164India } from './phone';

const SEND_STATUSES: SendStatus[] = ['queued', 'sent', 'delivered', 'failed', 'suppressed', 'opted_out'];

/** Marketing messages must carry an opt-out instruction to be compliant (and to stay
 * deliverable) — checked at activation rather than send time so a bad template fails loudly
 * before it reaches an audience. */
const OPT_OUT_HINT = /\b(stop|unsubscribe|opt.?out)\b/i;

@Injectable()
export class OutreachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly msg91: Msg91Provider,
    private readonly emailProvider: EmailProvider,
  ) {}

  // --- Contacts -----------------------------------------------------------

  async listContacts(query: {
    offset?: number;
    limit: number;
    search?: string;
    cityId?: string;
    status?: string;
    businessCategory?: string;
  }): Promise<OutreachContactsPage> {
    const { offset, limit, search, cityId, status, businessCategory } = query;

    const where: Prisma.OutreachContactWhereInput = {
      ...(cityId ? { cityId } : {}),
      ...(status ? { status: status as OutreachContact['status'] } : {}),
      ...(businessCategory ? { businessCategory } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { phoneE164: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.outreachContact.findMany({
        where,
        include: { city: true, area: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.outreachContact.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toContactDto(row)),
      total,
    };
  }

  /** Distinct `businessCategory` values actually present, for the admin filter dropdown —
   * derived from real data rather than a hardcoded list, so a newly-scraped category (this
   * table currently holds "pg"/"coworking" from Google Maps, but nothing stops a future import
   * adding others) shows up as a filter option without a code change. */
  async listBusinessCategories(): Promise<string[]> {
    const rows = await this.prisma.outreachContact.findMany({
      where: { businessCategory: { not: null } },
      select: { businessCategory: true },
      distinct: ['businessCategory'],
      orderBy: { businessCategory: 'asc' },
    });
    return rows.map((r) => r.businessCategory!).filter(Boolean);
  }

  /** Bulk import from a Maps pull or CSV. Upserts on googlePlaceId so re-running the same scrape
   * refreshes ratings instead of duplicating businesses, and drops rows with no usable channel
   * (a contact we can't message is just noise in every audience count). */
  async importContacts(input: ImportOutreachContactsInput): Promise<ImportOutreachContactsResult> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of input.contacts) {
      const phoneE164 = toE164India(raw.phone);
      const email = raw.email?.trim().toLowerCase() || null;
      if (!phoneE164 && !email) {
        skipped++;
        continue;
      }

      const data = {
        name: raw.name,
        phone: raw.phone ?? null,
        phoneE164,
        email,
        address: raw.address ?? null,
        lat: raw.lat ?? null,
        lng: raw.lng ?? null,
        cityId: raw.cityId ?? null,
        areaId: raw.areaId ?? null,
        googleRating: raw.googleRating ?? null,
        googleReviewCount: raw.googleReviewCount ?? null,
        googleRatingAt: raw.googleRating != null ? new Date() : null,
        businessCategory: raw.businessCategory ?? null,
        website: raw.website ?? null,
        source: input.source,
        sourceRef: raw.sourceRef ?? input.sourceRef ?? null,
        tags: raw.tags ?? [],
        notes: raw.notes ?? null,
        ...(raw.consentState ? { consentState: raw.consentState } : {}),
        consentSource: raw.consentSource ?? null,
        ...(raw.consentState === 'explicit' ? { consentAt: new Date() } : {}),
      };

      if (raw.googlePlaceId) {
        const existing = await this.prisma.outreachContact.findUnique({
          where: { googlePlaceId: raw.googlePlaceId },
          select: { id: true },
        });
        await this.prisma.outreachContact.upsert({
          where: { googlePlaceId: raw.googlePlaceId },
          // Never downgrade an existing opt-out via re-import — consentState is deliberately
          // omitted from the update path.
          update: { ...data, consentState: undefined, consentAt: undefined },
          create: { ...data, googlePlaceId: raw.googlePlaceId },
        });
        existing ? updated++ : created++;
      } else {
        await this.prisma.outreachContact.create({ data });
        created++;
      }
    }

    return { created, updated, skipped };
  }

  async createContact(input: CreateOutreachContactInput): Promise<OutreachContactDto> {
    const result = await this.importContacts({ source: input.source, contacts: [input] });
    if (result.skipped > 0) {
      throw new BadRequestException('A contact needs at least a valid phone number or an email address');
    }
    const contact = await this.prisma.outreachContact.findFirstOrThrow({
      where: input.googlePlaceId ? { googlePlaceId: input.googlePlaceId } : { name: input.name },
      include: { city: true, area: true },
      orderBy: { createdAt: 'desc' },
    });
    return this.toContactDto(contact);
  }

  /** Records an opt-out on both the contact and the channel-independent suppression list — the
   * latter is what survives the contact being deleted and re-imported by a later scrape. */
  async optOut(contactId: string, reason = 'manual opt-out'): Promise<void> {
    const contact = await this.prisma.outreachContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);

    const values = [contact.phoneE164, contact.email].filter((v): v is string => !!v);
    await this.prisma.$transaction([
      this.prisma.outreachContact.update({
        where: { id: contactId },
        data: { consentState: 'opted_out', optedOutAt: new Date() },
      }),
      ...values.map((value) =>
        this.prisma.suppressionEntry.upsert({
          where: { value },
          update: {},
          create: { value, reason },
        }),
      ),
    ]);
  }

  /** Sends the "verify your listing" WhatsApp to a bulk-imported business, so they can claim
   * the listing bulk_upload_listings.py created for them (see ListingsService.claimListing).
   * Not routed through OutreachCampaign/CampaignSend — this is a deliberate, one-contact,
   * script-triggered send (bulk_upload_listings.py --send-whatsapp), not an automated recurring
   * blast, so the full audience-resolution/audit-trail machinery doesn't apply. Still respects
   * the same compliance gates that machinery would (MSG91_MARKETING_ENABLED, consent/
   * suppression), since this is a cold, business-initiated contact just like a campaign send. */
  /** Sends the claim-verification nudge on **every** channel the contact actually has (email
   * AND WhatsApp, not one-or-the-other) — a deliberate departure from
   * NotificationsService.dispatchEmailPreferWhatsapp's usual email-preferred/WhatsApp-fallback
   * rule, chosen for this flow because "claim your free business listing" is worth the
   * redundancy. Each channel's claim link carries its own `?via=email`/`?via=whatsapp` so
   * ListingsService.claimListing can record which one the owner actually clicked — see
   * Listing.claimSource, surfaced as an admin column. */
  async sendClaimVerification(
    contactId: string,
  ): Promise<{ sent: boolean; channels: ClaimSource[]; reason?: string }> {
    if (this.config.get<string>('MSG91_MARKETING_ENABLED') !== 'true') {
      return { sent: false, channels: [], reason: 'Marketing sending is disabled (set MSG91_MARKETING_ENABLED=true)' };
    }

    const contact = await this.prisma.outreachContact.findUnique({
      where: { id: contactId },
      include: {
        claimedListing: { select: { id: true, claimedAt: true } },
        city: { select: { name: true } },
        area: { select: { name: true } },
      },
    });
    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);
    if (!contact.claimedListing) return { sent: false, channels: [], reason: 'No claimable listing linked to this contact' };
    if (contact.claimedListing.claimedAt) return { sent: false, channels: [], reason: 'This listing has already been claimed' };
    if (contact.consentState === 'opted_out') return { sent: false, channels: [], reason: 'This contact has opted out' };
    if (!contact.phoneE164 && !contact.email) {
      return { sent: false, channels: [], reason: 'No phone number or email on file for this contact' };
    }
    // The approved WhatsApp template names both — a send with either blank would either fail or
    // read as broken to the recipient, so this is checked rather than sending "undefined".
    if (!contact.city || !contact.area) {
      return { sent: false, channels: [], reason: 'This contact has no city/area on file' };
    }

    // One query for both channels' suppression status rather than two — audiences run large
    // elsewhere in this service, same reasoning as resolveEligible's own batched lookup.
    const suppressedValues = new Set(
      (
        await this.prisma.suppressionEntry.findMany({
          where: {
            value: { in: [contact.phoneE164, contact.email?.toLowerCase()].filter((v): v is string => !!v) },
          },
          select: { value: true },
        })
      ).map((s) => s.value),
    );

    const siteUrl = this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
    const listingId = contact.claimedListing.id;
    const channels: ClaimSource[] = [];

    if (contact.email && !suppressedValues.has(contact.email.toLowerCase())) {
      const sent = await this.sendClaimEmail(
        { name: contact.name, email: contact.email, area: contact.area, city: contact.city },
        listingId,
        siteUrl,
      );
      if (sent) channels.push('email');
    }

    if (contact.phoneE164 && !suppressedValues.has(contact.phoneE164)) {
      const result = await this.msg91.sendListingVerificationRequest(
        // Msg91Provider's WhatsApp methods all build `91${phone}` themselves (see
        // NotificationsService's calls, which pass the bare User.phone, never a +91-prefixed
        // one) — phoneE164 already carries the +91, so it's stripped here to avoid doubling it.
        contact.phoneE164.replace(/^\+91/, ''),
        {
          businessName: contact.name,
          area: contact.area.name,
          city: contact.city.name,
          phone: contact.phoneE164,
          claimLink: `${siteUrl}/claim/${listingId}?via=whatsapp`,
        },
        `${listingId}?via=whatsapp`,
      );
      if (result.sent) channels.push('whatsapp');
    }

    if (channels.length === 0) {
      return {
        sent: false,
        channels: [],
        reason: 'No eligible channel to send on — missing, suppressed, or every send attempt failed (check server logs)',
      };
    }

    await this.prisma.outreachContact.update({
      where: { id: contactId },
      data: { lastContactedAt: new Date(), contactedCount: { increment: 1 } },
    });
    return { sent: true, channels };
  }

  /** The claim-verification email's content — see notification-templates/email/claim-listing/
   * for the copy itself. BCC to support@ mirrors buildWelcomeEmailContent's own convention, so
   * someone at support@ can see every one of these actually going out. */
  private async sendClaimEmail(
    contact: { name: string; email: string; area: { name: string }; city: { name: string } },
    listingId: string,
    siteUrl: string,
  ): Promise<boolean> {
    const tpl = loadTemplate('email/claim-listing');
    const vars = { name: contact.name, area: contact.area.name, city: contact.city.name };
    const paragraphs = tpl.paragraphs.map((p) => renderEmailTemplate(p, vars));
    const buttonLabel = tpl.buttonLabel ? renderEmailTemplate(tpl.buttonLabel, vars) : undefined;
    const claimUrl = `${siteUrl}/claim/${listingId}?via=email`;
    const html = renderEmail({
      heading: renderEmailTemplate(tpl.heading, vars),
      preheader: renderEmailTemplate(tpl.preheader, vars),
      paragraphs,
      button: buttonLabel ? { label: buttonLabel, url: claimUrl } : undefined,
    });
    const text = paragraphs.join('\n\n') + (buttonLabel ? `\n\n${buttonLabel}: ${claimUrl}` : '');

    return this.emailProvider.send(contact.email, renderEmailTemplate(tpl.subject, vars), text, {
      html,
      bcc: 'support@bhavano.com',
    });
  }

  // --- Campaigns ----------------------------------------------------------

  async listCampaigns(query: { offset?: number; limit: number }): Promise<OutreachCampaignsPage> {
    const { offset, limit } = query;

    const [rows, total] = await Promise.all([
      this.prisma.outreachCampaign.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.outreachCampaign.count(),
    ]);

    const stats = await this.statsFor(rows.map((c) => c.id));

    return {
      items: rows.map((row) => this.toCampaignDto(row, stats[row.id])),
      total,
    };
  }

  async getCampaign(id: string): Promise<OutreachCampaignDto> {
    const campaign = await this.prisma.outreachCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    const stats = await this.statsFor([id]);
    return this.toCampaignDto(campaign, stats[id]);
  }

  /** The raw row, for callers that drive the runner directly (the admin's "run now"). */
  async requireCampaignRow(id: string): Promise<OutreachCampaign> {
    const campaign = await this.prisma.outreachCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async createCampaign(input: CreateOutreachCampaignInput, createdById: string): Promise<OutreachCampaignDto> {
    const campaign = await this.prisma.outreachCampaign.create({
      data: {
        name: input.name,
        channel: input.channel,
        bodyTemplate: input.bodyTemplate,
        subject: input.subject ?? null,
        dltTemplateId: input.dltTemplateId ?? null,
        audienceFilter: (input.audienceFilter ?? {}) as Prisma.InputJsonValue,
        cadenceCron: input.cadenceCron ?? null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        ...(input.maxSendsPerRun != null ? { maxSendsPerRun: input.maxSendsPerRun } : {}),
        ...(input.minDaysBetweenSends != null ? { minDaysBetweenSends: input.minDaysBetweenSends } : {}),
        // Defaults to true in the schema — a new campaign can never blast on its first tick.
        ...(input.dryRun != null ? { dryRun: input.dryRun } : {}),
        createdById,
      },
    });
    return this.toCampaignDto(campaign, emptyStats());
  }

  /** Activation (status → scheduled/running) is where compliance is enforced: an SMS/WhatsApp
   * campaign without a DLT template will be rejected by MSG91 anyway, and a marketing body with
   * no opt-out instruction is non-compliant — both are far cheaper to catch here than mid-run. */
  async updateCampaign(id: string, input: UpdateOutreachCampaignInput): Promise<OutreachCampaignDto> {
    const existing = await this.prisma.outreachCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Campaign ${id} not found`);

    const channel = input.channel ?? existing.channel;
    const bodyTemplate = input.bodyTemplate ?? existing.bodyTemplate;
    const dltTemplateId = input.dltTemplateId ?? existing.dltTemplateId;
    const activating = input.status === 'scheduled' || input.status === 'running';

    if (activating) {
      if (channel !== 'email' && !dltTemplateId) {
        throw new BadRequestException(
          'A DLT-registered template id is required before activating an SMS or WhatsApp campaign',
        );
      }
      if (!OPT_OUT_HINT.test(bodyTemplate)) {
        throw new BadRequestException(
          'Marketing messages must tell recipients how to opt out — include "STOP" or "unsubscribe" in the body',
        );
      }
    }

    const campaign = await this.prisma.outreachCampaign.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.channel != null ? { channel: input.channel } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.bodyTemplate != null ? { bodyTemplate: input.bodyTemplate } : {}),
        ...(input.subject !== undefined ? { subject: input.subject ?? null } : {}),
        ...(input.dltTemplateId !== undefined ? { dltTemplateId: input.dltTemplateId ?? null } : {}),
        ...(input.audienceFilter != null
          ? { audienceFilter: input.audienceFilter as Prisma.InputJsonValue }
          : {}),
        ...(input.cadenceCron !== undefined ? { cadenceCron: input.cadenceCron ?? null } : {}),
        ...(input.scheduledAt !== undefined
          ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
          : {}),
        ...(input.maxSendsPerRun != null ? { maxSendsPerRun: input.maxSendsPerRun } : {}),
        ...(input.minDaysBetweenSends != null ? { minDaysBetweenSends: input.minDaysBetweenSends } : {}),
        ...(input.dryRun != null ? { dryRun: input.dryRun } : {}),
      },
    });

    const stats = await this.statsFor([id]);
    return this.toCampaignDto(campaign, stats[id]);
  }

  // --- Audience resolution ------------------------------------------------

  /** Contacts matching the campaign's stored filter, before any eligibility rules. */
  audienceWhere(filter: CampaignAudienceFilter): Prisma.OutreachContactWhereInput {
    return {
      ...(filter.cityIds?.length ? { cityId: { in: filter.cityIds } } : {}),
      ...(filter.businessCategories?.length ? { businessCategory: { in: filter.businessCategories } } : {}),
      ...(filter.tags?.length ? { tags: { hasSome: filter.tags } } : {}),
      ...(filter.minRating != null ? { googleRating: { gte: filter.minRating } } : {}),
      ...(filter.statuses?.length
        ? { status: { in: filter.statuses as OutreachContact['status'][] } }
        : {}),
    };
  }

  /** The eligibility rules, in one place so the preview and the actual send can never disagree:
   * never message an opted-out contact, never message someone on the suppression list, never
   * message the same person more often than the campaign's own cadence allows, and require a
   * usable address for the campaign's channel. */
  async resolveEligible(
    campaign: Pick<
      OutreachCampaign,
      'audienceFilter' | 'channel' | 'minDaysBetweenSends' | 'maxSendsPerRun'
    >,
    limit?: number,
  ): Promise<{
    contacts: OutreachContact[];
    audienceSize: number;
    suppressedCount: number;
    recentlyContactedCount: number;
  }> {
    const filter = (campaign.audienceFilter ?? {}) as CampaignAudienceFilter;
    const where = this.audienceWhere(filter);

    const candidates = await this.prisma.outreachContact.findMany({ where });
    const audienceSize = candidates.length;

    const cutoff = new Date(Date.now() - campaign.minDaysBetweenSends * 24 * 60 * 60 * 1000);
    const needsPhone = campaign.channel !== 'email';

    const reachable = candidates.filter((c) =>
      needsPhone ? !!c.phoneE164 : !!c.email,
    );

    // One query rather than per-contact lookups — audiences run to thousands of rows.
    const values = reachable
      .map((c) => (needsPhone ? c.phoneE164 : c.email))
      .filter((v): v is string => !!v);
    const suppressed = new Set(
      (
        await this.prisma.suppressionEntry.findMany({
          where: { value: { in: values } },
          select: { value: true },
        })
      ).map((s) => s.value),
    );

    let suppressedCount = 0;
    let recentlyContactedCount = 0;
    const eligible: OutreachContact[] = [];

    for (const contact of reachable) {
      const value = needsPhone ? contact.phoneE164 : contact.email;
      if (contact.consentState === 'opted_out' || (value && suppressed.has(value))) {
        suppressedCount++;
        continue;
      }
      if (contact.lastContactedAt && contact.lastContactedAt > cutoff) {
        recentlyContactedCount++;
        continue;
      }
      eligible.push(contact);
    }

    const cap = limit ?? campaign.maxSendsPerRun;
    return {
      contacts: eligible.slice(0, cap),
      audienceSize,
      suppressedCount,
      recentlyContactedCount,
    };
  }

  /** Pre-flight check for the admin UI — the same resolution the runner will do, plus a few
   * rendered bodies so a broken placeholder is caught before anything is sent. */
  async previewCampaign(id: string): Promise<CampaignPreviewDto> {
    const campaign = await this.prisma.outreachCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const resolved = await this.resolveEligible(campaign);
    const withCity = await this.prisma.outreachContact.findMany({
      where: { id: { in: resolved.contacts.slice(0, 3).map((c) => c.id) } },
      include: { city: true },
    });

    return {
      audienceSize: resolved.audienceSize,
      eligibleCount: resolved.contacts.length,
      suppressedCount: resolved.suppressedCount,
      recentlyContactedCount: resolved.recentlyContactedCount,
      sampleBodies: withCity.map((c) => renderTemplate(campaign.bodyTemplate, c, c.city?.name ?? null)),
    };
  }

  // --- Send history -------------------------------------------------------

  async listSends(query: {
    offset?: number;
    limit: number;
    campaignId?: string;
    contactId?: string;
  }): Promise<CampaignSendsPage> {
    const { offset, limit, campaignId, contactId } = query;
    const where: Prisma.CampaignSendWhereInput = {
      ...(campaignId ? { campaignId } : {}),
      ...(contactId ? { contactId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.campaignSend.findMany({
        where,
        include: { campaign: { select: { name: true } }, contact: { select: { name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.campaignSend.count({ where }),
    ]);

    return {
      items: rows.map(
        (row): CampaignSendDto => ({
          id: row.id,
          campaignId: row.campaignId,
          campaignName: row.campaign.name,
          contactId: row.contactId,
          contactName: row.contact.name,
          channel: row.channel,
          status: row.status,
          runKey: row.runKey,
          renderedBody: row.renderedBody,
          sentAt: row.sentAt?.toISOString() ?? null,
          failureReason: row.failureReason,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
      total,
    };
  }

  // --- Mapping ------------------------------------------------------------

  private async statsFor(campaignIds: string[]): Promise<Record<string, Record<SendStatus, number>>> {
    const out: Record<string, Record<SendStatus, number>> = {};
    for (const id of campaignIds) out[id] = emptyStats();
    if (campaignIds.length === 0) return out;

    const grouped = await this.prisma.campaignSend.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      out[row.campaignId][row.status] = row._count._all;
    }
    return out;
  }

  private toContactDto(
    row: OutreachContact & { city?: { name: string } | null; area?: { name: string } | null },
  ): OutreachContactDto {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      phoneE164: row.phoneE164,
      email: row.email,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      cityId: row.cityId,
      cityName: row.city?.name ?? null,
      areaName: row.area?.name ?? null,
      googleRating: row.googleRating,
      googleReviewCount: row.googleReviewCount,
      googleRatingAt: row.googleRatingAt?.toISOString() ?? null,
      googlePlaceId: row.googlePlaceId,
      businessCategory: row.businessCategory,
      website: row.website,
      source: row.source,
      sourceRef: row.sourceRef,
      status: row.status,
      tags: row.tags,
      notes: row.notes,
      consentState: row.consentState,
      lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
      contactedCount: row.contactedCount,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toCampaignDto(row: OutreachCampaign, stats: Record<SendStatus, number>): OutreachCampaignDto {
    return {
      id: row.id,
      name: row.name,
      channel: row.channel,
      status: row.status,
      bodyTemplate: row.bodyTemplate,
      subject: row.subject,
      dltTemplateId: row.dltTemplateId,
      audienceFilter: (row.audienceFilter ?? {}) as CampaignAudienceFilter,
      cadenceCron: row.cadenceCron,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      maxSendsPerRun: row.maxSendsPerRun,
      minDaysBetweenSends: row.minDaysBetweenSends,
      dryRun: row.dryRun,
      createdAt: row.createdAt.toISOString(),
      stats,
    };
  }
}

function emptyStats(): Record<SendStatus, number> {
  return Object.fromEntries(SEND_STATUSES.map((s) => [s, 0])) as Record<SendStatus, number>;
}

/** Resolves {{name}}/{{city}} against a contact. Unknown placeholders are left intact rather
 * than blanked, so a typo shows up as "{{frist_name}}" in the preview instead of silently
 * vanishing into a message that reads fine but says the wrong thing. */
export function renderTemplate(
  template: string,
  contact: Pick<OutreachContact, 'name' | 'businessCategory'>,
  cityName: string | null,
): string {
  const values: Record<string, string> = {
    name: contact.name,
    city: cityName ?? '',
    category: contact.businessCategory ?? '',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}
