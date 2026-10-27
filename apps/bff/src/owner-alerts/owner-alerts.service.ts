import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_OWNER_ALERT_ORDER,
  normalizeOwnerAlertOrder,
  type OwnerAlertChannel,
  type OwnerAlertKind,
  type OwnerAlertPreferenceDto,
} from '@bhavano/types/ownerAlerts';
import { NotificationsService } from '../notifications/notifications.service';
import { Msg91Provider } from '../notifications/providers/msg91.provider';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

export interface OwnerAlert {
  kind: OwnerAlertKind;
  listingId: string;
  listingTitle: string;
  /** The other person's first name; absent for a reveal (the owner is not told who looked). */
  name?: string;
  conversationId?: string;
}

/** Walks the owner's channels in the order they chose and stops at the first one that delivers: the app (free, fastest), then WhatsApp / SMS / email as
 * available. A channel that cannot reach the account (no device, no phone, no address) or whose template is not configured yet is skipped silently, so
 * enabling WhatsApp is just setting the template env vars once Meta approves them. See docs/plans/owner-notification-channel-preferences.md. */
@Injectable()
export class OwnerAlertsService {
  private readonly logger = new Logger(OwnerAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly msg91: Msg91Provider,
    private readonly notifications: NotificationsService,
  ) {}

  async getPreference(userId: string): Promise<OwnerAlertPreferenceDto> {
    const [row, user, device] = await Promise.all([
      this.prisma.ownerAlertPreference.findUnique({ where: { userId }, select: { channels: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } }),
      this.prisma.pushToken.findFirst({ where: { userId }, select: { id: true } }),
    ]);
    return {
      channels: row ? normalizeOwnerAlertOrder(row.channels) : [...DEFAULT_OWNER_ALERT_ORDER],
      confirmed: row !== null,
      available: { push: device !== null, whatsapp: !!user?.phone, sms: !!user?.phone, email: !!user?.email },
    };
  }

  async setPreference(userId: string, channels: string[]): Promise<OwnerAlertPreferenceDto> {
    const ordered = normalizeOwnerAlertOrder(channels);
    await this.prisma.ownerAlertPreference.upsert({
      where: { userId },
      create: { userId, channels: ordered },
      update: { channels: ordered },
    });
    return this.getPreference(userId);
  }

  /** Fire-and-forget for callers: never throws, never delays the action that caused it. Resolves to the channel that delivered (for the caller's
   * ListingNotificationLog row), or null when nothing could. */
  async alert(ownerId: string, alert: OwnerAlert): Promise<OwnerAlertChannel | null> {
    try {
      const [pref, user] = await Promise.all([
        this.prisma.ownerAlertPreference.findUnique({ where: { userId: ownerId }, select: { channels: true } }),
        this.prisma.user.findUnique({ where: { id: ownerId }, select: { phone: true, email: true } }),
      ]);
      if (!user) return null;
      const order = pref ? normalizeOwnerAlertOrder(pref.channels) : [...DEFAULT_OWNER_ALERT_ORDER];
      for (const channel of order) {
        if (await this.trySend(channel, ownerId, user, alert)) return channel;
      }
      return null;
    } catch (err) {
      this.logger.error(`Owner alert (${alert.kind}) failed for listing ${alert.listingId}`, err);
      return null;
    }
  }

  private async trySend(
    channel: OwnerAlertChannel,
    ownerId: string,
    user: { phone: string | null; email: string | null },
    a: OwnerAlert,
  ): Promise<boolean> {
    const vars = { title: a.listingTitle, name: a.name };
    switch (channel) {
      case 'push':
        // A message and an interest are pushed by their own code paths, always and before this runs, so "push" is satisfied exactly when the owner has a
        // device. Only the reveal has no push of its own, so it is sent here.
        if (a.kind === 'reveal') {
          return this.push.notifyContactRevealed(ownerId, { listingId: a.listingId, listingTitle: a.listingTitle });
        }
        return (await this.prisma.pushToken.findFirst({ where: { userId: ownerId }, select: { id: true } })) !== null;
      case 'whatsapp': {
        if (!user.phone) return false;
        const suffix = a.kind === 'message' && a.conversationId ? a.conversationId : 'my-listings';
        const { sent } = await this.msg91.sendOwnerAlert(user.phone, a.kind, { ...vars, buttonSuffix: suffix });
        return sent;
      }
      case 'sms':
        return user.phone ? this.msg91.sendOwnerAlertSms(user.phone, a.kind, vars) : false;
      case 'email':
        return this.notifications.sendOwnerAlertEmail(user, a.kind, vars, a.conversationId);
    }
  }
}

