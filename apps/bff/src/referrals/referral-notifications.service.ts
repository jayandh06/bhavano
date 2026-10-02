import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { DEFAULT_REFERRAL_SETTINGS, REFERRAL_SETTINGS_ID } from './referrals.constants';

const dateText = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const daysText = (n: number) => `${n}-day`;

/** Phase 6 of docs/plans/bhavano-referral-program-implementation.md: email (when the user has
 * one) plus push for every referral event. Best-effort — a failed alert never affects the
 * referral or credit it is about, so every method logs and swallows its own errors. */
@Injectable()
export class ReferralNotificationsService {
  private readonly logger = new Logger(ReferralNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  async referralSignedUp(referrerId: string, friendName: string | null): Promise<void> {
    const friend = friendName?.trim().split(/\s+/)[0] || 'A friend';
    const settings = await this.prisma.referralSetting
      .findUnique({ where: { id: REFERRAL_SETTINGS_ID }, select: { boostDays: true } })
      .catch(() => null);
    const boostDays = settings?.boostDays ?? DEFAULT_REFERRAL_SETTINGS.boostDays;
    await this.send(referrerId, 'signup', (user) => [
      this.notifications.notifyReferralSignup(user, { friendName: friend, boostDays }),
      this.push.notifyReferral(referrerId, {
        kind: 'referral_signup',
        title: `${friend} joined through your link`,
        body: `When their first ad is approved, you get a free ${daysText(boostDays)} boost.`,
      }),
    ]);
  }

  async rewardGranted(referrerId: string, boostDays: number, expiresAt: Date): Promise<void> {
    await this.send(referrerId, 'reward', (user) => [
      this.notifications.notifyReferralRewardGranted(user, { boostDays, expiresAt }),
      this.push.notifyReferral(referrerId, {
        kind: 'referral_reward',
        title: 'You earned a free boost!',
        body: `Use your free ${daysText(boostDays)} boost on any of your ads before ${dateText(expiresAt)}.`,
      }),
    ]);
  }

  async creditExpiring(userId: string, boostDays: number, expiresAt: Date): Promise<boolean> {
    return this.send(userId, 'expiring', (user) => [
      this.notifications.notifyReferralCreditExpiring(user, { boostDays, expiresAt }),
      this.push.notifyReferral(userId, {
        kind: 'referral_expiring',
        title: 'Your free boost expires soon',
        body: `Use your free ${daysText(boostDays)} boost before ${dateText(expiresAt)}.`,
      }),
    ]);
  }

  async creditRevoked(userId: string): Promise<void> {
    await this.send(userId, 'revoked', (user) => [
      this.notifications.notifyReferralCreditRevoked(user),
      this.push.notifyReferral(userId, {
        kind: 'referral_revoked',
        title: 'A free boost was removed',
        body: 'The referral it came from no longer qualifies.',
      }),
    ]);
  }

  /** False when the user is gone or every send threw. */
  private async send(
    userId: string,
    label: string,
    build: (user: { email: string | null; phone: string | null }) => Promise<unknown>[],
  ): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true, deletedAt: true },
      });
      if (!user || user.deletedAt) return false;
      const results = await Promise.allSettled(build(user));
      for (const r of results) {
        if (r.status === 'rejected') this.logger.warn(`Referral ${label} alert to ${userId} failed: ${String(r.reason)}`);
      }
      return results.some((r) => r.status === 'fulfilled');
    } catch (err) {
      this.logger.warn(`Referral ${label} alert to ${userId} failed: ${String(err)}`);
      return false;
    }
  }
}
