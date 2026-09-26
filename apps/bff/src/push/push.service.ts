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

/** Android channels the mobile app creates in `apps/mobile/src/lib/push.ts` — must match
 * exactly or Expo drops the notification when the channel is missing. */
export const PUSH_CHANNEL_MESSAGES = 'messages';
export const PUSH_CHANNEL_LISTING_ACTIVITY = 'listing_activity';

/**
 * Android status-bar / tray small icon — drawable name produced by the `expo-notifications`
 * config plugin from `app.config.js`'s `icon: "./assets/android-icon-monochrome.png"`.
 * Omitted payloads fall back to the same default; setting it explicitly keeps kinds consistent
 * if a future channel ever overrides the plugin default.
 */
const ANDROID_NOTIFICATION_ICON = 'notification_icon';

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Subset of Expo Push Message fields we actually send — see
 * https://docs.expo.dev/push-notifications/sending-notifications/ */
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: Record<string, string>;
  priority: 'default' | 'normal' | 'high';
  icon: string;
  subtitle?: string;
  badge?: number;
  collapseId?: string;
  tag?: string;
  threadId?: string;
  interruptionLevel?: 'active' | 'critical' | 'passive' | 'time-sensitive';
  richContent?: { image: string };
}

interface PushContent {
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
  /** iOS — shown under the title. */
  subtitle?: string;
  /** iOS app-icon badge. */
  badge?: number;
  /** Coalesce in-transit + (on iOS) replace displayed. */
  collapseId?: string;
  /** Android — replace an already-shown notification with the same tag. */
  tag?: string;
  /** iOS — visually group related notifications. */
  threadId?: string;
  priority?: 'default' | 'normal' | 'high';
  interruptionLevel?: 'active' | 'critical' | 'passive' | 'time-sensitive';
  /** Large image in the expanded notification (Android out of the box; iOS needs an NSE). */
  imageUrl?: string;
}

/**
 * Expo push to a user's mobile devices for advertiser engagement (messages, listing views /
 * interest, favourites).
 *
 * Called directly over HTTP (no `expo-server-sdk` dependency) for the same reason
 * `whatsapp.provider.ts` calls the Graph API directly — one less package between us and the
 * upstream, and the payload is a single well-documented shape.
 *
 * Best-effort exactly like the notification providers: unconfigured logs and skips, a failed
 * send logs and returns. Nothing here may throw into the request path that triggered it.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  /** Avoid spamming logs on every like/message while the flag is off. */
  private loggedDisabledSkip = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    if (this.enabled) {
      if (this.accessToken) {
        this.logger.log('Expo push enabled (EXPO_PUSH_ENABLED=true, EXPO_ACCESS_TOKEN set)');
      } else {
        this.logger.warn(
          'Expo push enabled but EXPO_ACCESS_TOKEN is unset — Expo will 403 if the project has push security on (@finfolia-technologies-llp/bhavano)',
        );
      }
    } else {
      this.logger.warn(
        'Expo push disabled — set EXPO_PUSH_ENABLED=true on this BFF and restart to deliver OS notifications',
      );
    }
  }

  /** Off by default — a dev machine has no Expo project set up and should not be firing real
   * pushes. Set EXPO_PUSH_ENABLED=true in the deployed BFF. */
  get enabled(): boolean {
    return this.config.get<string>('EXPO_PUSH_ENABLED') === 'true';
  }

  /** Personal access token from expo.dev → Access tokens. Required when the EAS project has
   * "Enhanced security for push notifications" enabled (anonymous send → 403 UNAUTHORIZED). */
  private get accessToken(): string | undefined {
    const raw = this.config.get<string>('EXPO_ACCESS_TOKEN')?.trim();
    return raw || undefined;
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
    opts: { unreadCount?: number; listingTitle?: string } = {},
  ): Promise<void> {
    // Always a freshly-sent message here (see sendMessage/sendFirstMessage), never a deleted
    // one, so body is never actually null despite MessageDto's general shape.
    const rawBody = message.body!;
    const body =
      rawBody.length > BODY_PREVIEW_CHARS ? `${rawBody.slice(0, BODY_PREVIEW_CHARS - 1)}…` : rawBody;
    const listingTitle = opts.listingTitle?.trim();

    await this.sendToUser(recipientId, {
      // Listing title leads, sender is a prefix on the message — the group-chat convention. Not
      // Expo's `subtitle` for the sender: that field is iOS-only, so on Android the sender would
      // vanish entirely. Falls back to the sender as title when the ad's title is unknown.
      title: listingTitle || senderName,
      body: listingTitle ? `${senderName}: ${body}` : body,
      badge: opts.unreadCount,
      channelId: PUSH_CHANNEL_MESSAGES,
      priority: 'high',
      interruptionLevel: 'time-sensitive',
      collapseId: message.conversationId,
      tag: `msg:${message.conversationId}`,
      threadId: message.conversationId,
      data: {
        kind: 'message',
        conversationId: message.conversationId,
        ...(listingTitle ? { listingTitle } : {}),
      },
    });
  }

  /** Owner push when a logged-in seeker opens their listing (interest / view). */
  async notifyListingInterest(
    recipientId: string,
    params: {
      listingId: string;
      listingTitle: string;
      interestedName: string;
      imageUrl?: string;
    },
  ): Promise<void> {
    await this.sendToUser(recipientId, {
      title: params.listingTitle,
      body: `👀 ${params.interestedName} viewed your ad`,
      channelId: PUSH_CHANNEL_LISTING_ACTIVITY,
      priority: 'high',
      interruptionLevel: 'active',
      collapseId: `interest:${params.listingId}`,
      tag: `interest:${params.listingId}`,
      threadId: params.listingId,
      imageUrl: params.imageUrl,
      data: {
        kind: 'listing_interest',
        path: '/my-listings',
        listingId: params.listingId,
      },
    });
  }

  /** Owner push when someone favourites their listing — all ads, not only boosted (email/WhatsApp
   * for likes stays boost-gated). */
  async notifyListingFavourite(
    recipientId: string,
    params: {
      listingId: string;
      listingTitle: string;
      likerName: string;
      imageUrl?: string;
    },
  ): Promise<void> {
    await this.sendToUser(recipientId, {
      title: params.listingTitle,
      body: `❤️ ${params.likerName} favourited your ad`,
      channelId: PUSH_CHANNEL_LISTING_ACTIVITY,
      priority: 'high',
      interruptionLevel: 'active',
      collapseId: `favourite:${params.listingId}`,
      tag: `favourite:${params.listingId}`,
      threadId: params.listingId,
      imageUrl: params.imageUrl,
      data: {
        kind: 'listing_favourite',
        path: '/my-listings',
        listingId: params.listingId,
      },
    });
  }

  private async sendToUser(recipientId: string, content: PushContent): Promise<void> {
    if (!this.enabled) {
      if (!this.loggedDisabledSkip) {
        this.loggedDisabledSkip = true;
        this.logger.warn(
          `Skipping push for user ${recipientId} (and further recipients) — EXPO_PUSH_ENABLED is not "true"`,
        );
      }
      return;
    }

    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: { userId: recipientId },
        select: { token: true },
      });
      if (tokens.length === 0) {
        // Not debug: "the recipient has no registered device" is the most common reason a push
        // never shows up, and it has to be visible at the default log level to diagnose.
        this.logger.log(
          `No PushToken rows for user ${recipientId}; nothing to send for "${content.title}"`,
        );
        return;
      }

      const stale = new Set<string>();
      let accepted = 0;
      let rejected = 0;
      for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        const chunk = tokens.slice(i, i + CHUNK_SIZE);
        const payload: ExpoPushMessage[] = chunk.map(({ token }) => {
          const msg: ExpoPushMessage = {
            to: token,
            title: content.title,
            body: content.body,
            sound: 'default',
            channelId: content.channelId,
            data: content.data,
            priority: content.priority ?? 'high',
            icon: ANDROID_NOTIFICATION_ICON,
          };
          if (content.subtitle) msg.subtitle = content.subtitle;
          if (content.badge !== undefined) msg.badge = content.badge;
          if (content.collapseId) msg.collapseId = content.collapseId;
          if (content.tag) msg.tag = content.tag;
          if (content.threadId) msg.threadId = content.threadId;
          if (content.interruptionLevel) msg.interruptionLevel = content.interruptionLevel;
          if (content.imageUrl) msg.richContent = { image: content.imageUrl };
          return msg;
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (this.accessToken) {
          headers.Authorization = `Bearer ${this.accessToken}`;
        }

        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
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
          if (ticket.status === 'ok') accepted += 1;
          else rejected += 1;
          if (ticket.status === 'error') {
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

      this.logger.log(
        `Push to user ${recipientId} ("${content.title}"): ${tokens.length} device(s), ${accepted} accepted by Expo, ${rejected} rejected`,
      );

      if (stale.size > 0) {
        this.logger.warn(
          `Removing ${stale.size} unregistered push token(s) for user ${recipientId} (Expo: DeviceNotRegistered) — the device re-registers on its next login or cold start`,
        );
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
