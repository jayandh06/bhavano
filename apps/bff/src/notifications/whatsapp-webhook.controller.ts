import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Param, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * MSG91 WhatsApp delivery/read status callbacks — configured manually in the MSG91 dashboard
 * (Manage -> Webhook), pointed at this exact URL including its secret. Not signed the way
 * Razorpay's webhook is (see PaymentsController.webhook) — MSG91 has no HMAC on these callbacks,
 * so the secret path segment is the only thing standing in for that. Public (no AuthGuard): MSG91
 * calls this server-to-server with no bearer token.
 *
 * Every call is still captured verbatim into WhatsappWebhookEvent regardless of whether it parses
 * (see that model's own doc comment for why) — that stopped being a hedge against total ignorance
 * once MSG91's dashboard "Test Webhook" button delivered a real sample payload on 2026-09-08, and
 * is now just a durable audit trail. `extractStatus` below reads real confirmed field names
 * (`eventName`, `requestId`) — a real send-and-webhook round trip that same day confirmed
 * `requestId` here is exactly the `request_id` Msg91Provider.sendAdPostedConfirmation's send
 * response returns and stores as providerMessageId.
 */
/** One delivery report from Meta's WhatsApp webhook (`entry[].changes[].value.statuses[]`). */
export interface MetaStatus {
  messageId: string;
  status: string;
  errorCode: number | null;
  errorTitle: string | null;
}

/** Pulls every status out of a Meta webhook body. Anything that is not a status (an inbound message, a
 * template-quality change) yields nothing here; the raw body is still stored by the caller. */
export function extractMetaStatuses(body: unknown): MetaStatus[] {
  const out: MetaStatus[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown } })?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const s of statuses as Array<Record<string, unknown>>) {
        if (typeof s.id !== 'string' || typeof s.status !== 'string') continue;
        const err = Array.isArray(s.errors) ? (s.errors[0] as Record<string, unknown> | undefined) : undefined;
        out.push({
          messageId: s.id,
          status: s.status.toLowerCase(),
          errorCode: typeof err?.code === 'number' ? err.code : null,
          errorTitle: typeof err?.title === 'string' ? err.title : null,
        });
      }
    }
  }
  return out;
}

@Controller('webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post('msg91-whatsapp-status/:secret')
  async handleStatus(
    @Param('secret') secret: string,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const expected = this.config.get<string>('MSG91_WEBHOOK_SECRET');
    if (!expected || secret !== expected) {
      throw new ForbiddenException();
    }

    await this.prisma.whatsappWebhookEvent.create({
      data: { rawBody: (body ?? {}) as Prisma.InputJsonValue },
    });
    this.logger.log(`MSG91 webhook received: ${JSON.stringify(body)}`);

    const { messageId, status } = this.extractStatus(body);
    if (messageId && status) {
      const updated = await this.prisma.listingNotificationLog.updateMany({
        where: { providerMessageId: messageId },
        data: { deliveryStatus: status, deliveryStatusAt: new Date() },
      });
      if (updated.count === 0) {
        this.logger.warn(
          `MSG91 webhook status "${status}" for unrecognized message id ${messageId} — no matching ListingNotificationLog row ` +
            `(expected for the welcome template's own WhatsApp sends — those aren't tracked here, only ad-posted-confirmation)`,
        );
      }
    } else {
      this.logger.warn(
        'MSG91 webhook payload missing eventName/requestId — read WhatsappWebhookEvent to see what actually arrived.',
      );
    }

    return { received: true };
  }

  /** Confirmed against a real MSG91 send-and-webhook round trip on 2026-09-08 (see this class's
   * own doc comment) — NOT a guess. `eventName` ("Delivered"/"delivered"/"Sent"/"Read"/"Failed" —
   * casing varies between events, lowercased here to match
   * ListingNotificationLog.deliveryStatus's own convention) and `requestId`, which is exactly the
   * `request_id` Msg91Provider.sendAdPostedConfirmation's send response returns. */
  private extractStatus(body: unknown): { messageId: string | null; status: string | null } {
    if (!body || typeof body !== 'object') return { messageId: null, status: null };
    const b = body as Record<string, unknown>;
    const messageId = typeof b.requestId === 'string' && b.requestId.length > 0 ? b.requestId : null;
    const status = typeof b.eventName === 'string' ? b.eventName.toLowerCase() : null;
    return { messageId, status };
  }

  /**
   * Meta's webhook subscription handshake (WhatsApp > Configuration > Callback URL): Meta calls this once
   * with a challenge and our verify token, and expects the challenge echoed back. Only for
   * WHATSAPP_TRANSPORT=meta; see docs/plans/whatsapp-direct-meta-transport.md.
   */
  @Get('whatsapp-meta')
  verifyMeta(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (!expected || mode !== 'subscribe' || token !== expected || !challenge) {
      throw new ForbiddenException();
    }
    return challenge;
  }

  /**
   * Meta's delivery/read/failed reports for messages sent directly through the Cloud API. Public, but
   * signed: Meta sends `X-Hub-Signature-256: sha256=<hmac of the raw body with the app secret>`, checked
   * here against WHATSAPP_APP_SECRET (unset = reject everything). Statuses are matched to
   * ListingNotificationLog by message id exactly like the MSG91 webhook does, and a failed status is
   * logged with Meta's error code, which is the thing that was missing during the 2026-11-17 outage.
   */
  @Post('whatsapp-meta')
  @HttpCode(200)
  async handleMetaStatus(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret || !signature || !this.validSignature(secret, req.rawBody ?? Buffer.from(''), signature)) {
      throw new ForbiddenException();
    }

    await this.prisma.whatsappWebhookEvent.create({ data: { rawBody: (body ?? {}) as Prisma.InputJsonValue } });

    for (const s of extractMetaStatuses(body)) {
      if (s.status === 'failed') {
        this.logger.warn(`WhatsApp (Meta) message ${s.messageId} failed: ${s.errorCode ?? '?'} ${s.errorTitle ?? ''}`.trim());
      }
      await this.prisma.listingNotificationLog.updateMany({
        where: { providerMessageId: s.messageId },
        data: { deliveryStatus: s.status, deliveryStatusAt: new Date() },
      });
    }
    return { received: true };
  }

  private validSignature(secret: string, rawBody: Buffer, header: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
