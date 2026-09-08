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
 * is now just a durable audit trail. `extractStatus` below reads real confirmed field names from
 * that sample (`eventName`, `uuid`, `requestId`) rather than a guess — see its own comment for
 * what's still unconfirmed (which of `uuid`/`requestId` actually matches what
 * Msg91Provider.sendAdPostedConfirmation's own send response returns; both are tried until one is
 * ruled out against a real correlated send).
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

    const { messageIds, status } = this.extractStatus(body);
    if (messageIds.length > 0 && status) {
      const updated = await this.prisma.listingNotificationLog.updateMany({
        where: { providerMessageId: { in: messageIds } },
        data: { deliveryStatus: status, deliveryStatusAt: new Date() },
      });
      if (updated.count === 0) {
        this.logger.warn(
          `MSG91 webhook status "${status}" for unrecognized message id(s) ${messageIds.join(', ')} — no matching ListingNotificationLog row`,
        );
      }
    } else {
      this.logger.warn(
        'MSG91 webhook payload missing eventName/uuid/requestId — read WhatsappWebhookEvent to see what actually arrived.',
      );
    }

    return { received: true };
  }

  /** Confirmed against a real MSG91 "Test Webhook" sample payload (see this class's own doc
   * comment) — NOT a guess. Fields seen: `eventName` ("Delivered"/"Sent"/"Read"/"Failed", title
   * case — lowercased here to match ListingNotificationLog.deliveryStatus's convention), `uuid`
   * (WhatsApp's own wamid.-prefixed message id) and `requestId` (MSG91's own id for the same
   * send). Still unconfirmed: which of those two ids is what
   * Msg91Provider.sendAdPostedConfirmation's send response actually returns and stores as
   * providerMessageId — both are matched against until a real correlated send settles it, at
   * which point this can drop to whichever one actually matched. */
  private extractStatus(body: unknown): { messageIds: string[]; status: string | null } {
    if (!body || typeof body !== 'object') return { messageIds: [], status: null };
    const b = body as Record<string, unknown>;
    const messageIds = [b.uuid, b.requestId].filter((v): v is string => typeof v === 'string' && v.length > 0);
    const status = typeof b.eventName === 'string' ? b.eventName.toLowerCase() : null;
    return { messageIds, status };
  }
}
