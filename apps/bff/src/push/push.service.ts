import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MessageDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo's documented cap per request. */
const CHUNK_SIZE = 100;
/** WhatsApp-preview length — enough to read the gist on a lock screen, short enough not to
 * dump a whole paragraph into a notification. */
const BODY_PREVIEW_CHARS = 140;

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * "New message" push to a user's mobile devices, via Expo's push service.
 *
 * Called directly over HTTP (no `expo-server-sdk` dependency) for the same reason
 * `whatsapp.provider.ts` calls the Graph API directly — one less package between us and the
 * upstream, and the payload is a single well-documented shape.
 *
 * Best-effort exactly like the notification providers: unconfigured logs and skips, a failed
 * send logs and returns. Nothing here may throw into the send-message request path.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Off by default — a dev machine has no Expo project set up and should not be firing real
   * pushes. Set EXPO_PUSH_ENABLED=true in the deployed BFF. */
  get enabled(): boolean {
    return this.config.get<string>('EXPO_PUSH_ENABLED') === 'true';
  }

  /** Upsert on the token, not on (userId, platform): the same physical device logging into a
   * different account must re-point its one row, so the previous user stops getting this
   * device's message pushes. */
  async registerToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, lastSeenAt: new Date() },
      create: { userId, token, platform },
    });
  }

  async removeToken(token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token } });
  }

  async notifyNewMessage(
    recipientId: string,
    message: MessageDto,
    senderName: string,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId: recipientId },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const body =
        message.body.length > BODY_PREVIEW_CHARS
          ? `${message.body.slice(0, BODY_PREVIEW_CHARS - 1)}…`
          : message.body;

      const stale = new Set<string>();
      for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        const chunk = tokens.slice(i, i + CHUNK_SIZE);
        const payload = chunk.map(({ token }) => ({
          to: token,
          title: senderName,
          body,
          sound: 'default',
          channelId: 'messages',
          data: { conversationId: message.conversationId },
        }));

        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          this.logger.error(
            `Expo push failed (${res.status}) for user ${recipientId}: ${await res.text()}`,
          );
          continue;
        }

        const parsed = (await res.json()) as { data?: ExpoTicket[] };
        (parsed.data ?? []).forEach((ticket, idx) => {
          if (ticket.status === 'error') {
            // The only ticket error worth acting on: the token is dead (app uninstalled, or
            // the OS rotated it). Anything else (rate limit, transient) we just log.
            if (ticket.details?.error === 'DeviceNotRegistered') {
              stale.add(chunk[idx].token);
            } else {
              this.logger.warn(
                `Expo push ticket error for user ${recipientId}: ${ticket.message ?? ticket.details?.error ?? 'unknown'}`,
              );
            }
          }
        });
      }

      if (stale.size > 0) {
        await this.prisma.pushToken.deleteMany({
          where: { token: { in: [...stale] } },
        });
      }
    } catch (error) {
      this.logger.error(
        `Expo push threw for user ${recipientId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
