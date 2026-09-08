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
 * The exact payload shape is not confirmed against a real event yet — every call is captured
 * verbatim into WhatsappWebhookEvent regardless of whether it parses (see that model's own doc
 * comment for why), so the real shape can be read back once a live status event actually arrives.
 * `extractStatus` below is a first guess at common MSG91/WhatsApp field names — update it, and
 * only it, once a real payload is on hand rather than trusting this blind.
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
          `MSG91 webhook status "${status}" for unrecognized messageId ${messageId} — no matching ListingNotificationLog row`,
        );
      }
    } else {
      this.logger.warn(
        'MSG91 webhook payload did not match any known shape — read WhatsappWebhookEvent to learn the real one and fix extractStatus.',
      );
    }

    return { received: true };
  }

  /** Best-effort guess at MSG91's WhatsApp status webhook shape — unverified against a real
   * payload, so it tries a handful of plausible field names/paths rather than trusting one.
   * Replace this once WhatsappWebhookEvent has captured a real event to read the actual shape
   * from — same "trust what MSG91 actually sends, not generic docs" lesson
   * Msg91Provider.sendWhatsappTemplate's own doc comment already learned once, for the send side. */
  private extractStatus(body: unknown): { messageId: string | null; status: string | null } {
    if (!body || typeof body !== 'object') return { messageId: null, status: null };
    const b = body as Record<string, unknown>;
    const data = (b.data ?? {}) as Record<string, unknown>;
    const messageId = [b.messageId, b.message_id, b.msg_id, b.id, data.messageId, data.message_id, data.id].find(
      (v) => typeof v === 'string',
    );
    const status = [b.status, b.event, b.type, data.status].find((v) => typeof v === 'string');
    return {
      messageId: typeof messageId === 'string' ? messageId : null,
      status: typeof status === 'string' ? status.toLowerCase() : null,
    };
  }
}
