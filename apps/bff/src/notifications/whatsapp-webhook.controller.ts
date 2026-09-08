import { Body, Controller, ForbiddenException, Logger, Param, Post } from '@nestjs/common';
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
}
