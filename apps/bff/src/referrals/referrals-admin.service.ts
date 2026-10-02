import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AdminReferralDetailDto,
  AdminReferralDto,
  AdminReferralsPage,
  ReferralFunnelDto,
  ReferralSettingsDto,
  ReferralStatus,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { REFERRAL_SETTINGS_ID } from './referrals.constants';
import { ReferralsService, istMonthStart } from './referrals.service';
import { ReferralNotificationsService } from './referral-notifications.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const USER_SELECT = { id: true, name: true, phone: true } as const;
const REFERRAL_INCLUDE = {
  referrer: { select: { ...USER_SELECT, referralFrozenAt: true, referralFrozenReason: true } },
  referredUser: { select: USER_SELECT },
  creditBatch: { select: { grantedAt: true, expiresAt: true, redeemedAt: true, revokedAt: true, revokedReason: true } },
} satisfies Prisma.ReferralInclude;

type ReferralRow = Prisma.ReferralGetPayload<{ include: typeof REFERRAL_INCLUDE }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

function toDto(r: ReferralRow): AdminReferralDto {
  return {
    id: r.id,
    status: r.status as ReferralStatus,
    rewardSkippedReason: r.rewardSkippedReason,
    referrer: {
      id: r.referrer.id,
      name: r.referrer.name,
      phone: r.referrer.phone,
      referralFrozenAt: iso(r.referrer.referralFrozenAt),
      referralFrozenReason: r.referrer.referralFrozenReason,
    },
    referred: { id: r.referredUser.id, name: r.referredUser.name, phone: r.referredUser.phone },
    clickedAt: iso(r.clickedAt),
    signedUpAt: r.signedUpAt.toISOString(),
    firstAdApprovedAt: iso(r.firstAdApprovedAt),
    rewardedAt: iso(r.rewardedAt),
    credit: r.creditBatch
      ? {
          grantedAt: r.creditBatch.grantedAt.toISOString(),
          expiresAt: r.creditBatch.expiresAt.toISOString(),
          redeemedAt: iso(r.creditBatch.redeemedAt),
          revokedAt: iso(r.creditBatch.revokedAt),
          revokedReason: r.creditBatch.revokedReason,
        }
      : null,
  };
}

/** Phase 5 of docs/plans/bhavano-referral-program-implementation.md: the admin Referrals
 * section — settings, list, detail, funnel, and the review actions. Every action writes a
 * ReferralAdminAction row ("never silent"). */
@Injectable()
export class ReferralsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly notifier: ReferralNotificationsService,
  ) {}

  async getSettings(): Promise<ReferralSettingsDto> {
    const s = await this.referrals.getSettings();
    return {
      boostDays: s.boostDays,
      creditExpiryDays: s.creditExpiryDays,
      monthlyCapPerReferrer: s.monthlyCapPerReferrer,
      bonusExtraBoostAtReferrals: s.bonusExtraBoostAtReferrals,
      topAgentBadgeAtReferrals: s.topAgentBadgeAtReferrals,
      welcomeRewardEnabled: s.welcomeRewardEnabled,
      welcomeRewardFeaturedDays: s.welcomeRewardFeaturedDays,
      attributionWindowDays: s.attributionWindowDays,
      takedownRevocationWindowDays: s.takedownRevocationWindowDays,
    };
  }

  async updateSettings(input: ReferralSettingsDto): Promise<ReferralSettingsDto> {
    await this.prisma.referralSetting.upsert({
      where: { id: REFERRAL_SETTINGS_ID },
      create: { id: REFERRAL_SETTINGS_ID, ...input },
      update: input,
    });
    return this.getSettings();
  }

  async list(query: {
    status?: ReferralStatus;
    frozen?: boolean;
    referrerId?: string;
    offset?: number;
    limit: number;
  }): Promise<AdminReferralsPage> {
    const where: Prisma.ReferralWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.referrerId ? { referrerId: query.referrerId } : {}),
      ...(query.frozen ? { referrer: { referralFrozenAt: { not: null } } } : {}),
    };
    const [rows, total, flaggedTotal] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        include: REFERRAL_INCLUDE,
        orderBy: [{ signedUpAt: 'desc' }, { id: 'asc' }],
        skip: query.offset ?? 0,
        take: query.limit,
      }),
      this.prisma.referral.count({ where }),
      this.prisma.referral.count({ where: { status: 'blocked' } }),
    ]);
    return { items: rows.map(toDto), total, flaggedTotal };
  }

  async detail(id: string): Promise<AdminReferralDetailDto> {
    const row = await this.prisma.referral.findUnique({ where: { id }, include: REFERRAL_INCLUDE });
    if (!row) throw new NotFoundException('Referral not found');

    const [referralsTotal, creditsThisMonth, balance, approvedAds, actions, clicksByKind] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: row.referrerId } }),
      this.prisma.referralCreditBatch.count({
        where: { userId: row.referrerId, bonusTier: null, grantedAt: { gte: istMonthStart() } },
      }),
      this.referrals.getBalanceForUser(row.referrerId),
      this.prisma.listing.count({
        where: { ownerId: row.referrerId, moderationState: 'approved', publishState: 'live' },
      }),
      this.prisma.referralAdminAction.findMany({
        where: { OR: [{ referralId: id }, { targetUserId: row.referrerId, referralId: null }] },
        include: { admin: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // "Which user's share links were clicked" — both signals for this referrer across every
      // listing they've ever shared, not just this one referral: how many times someone opened
      // their link (kind:'open') and how many times they themselves tapped Share (kind:'share_tap').
      this.prisma.referralClick.groupBy({
        by: ['kind'],
        where: { referrerId: row.referrerId },
        _count: { _all: true },
      }),
    ]);
    const clickCounts = Object.fromEntries(clicksByKind.map((g) => [g.kind, g._count._all]));

    return {
      ...toDto(row),
      referrerStats: {
        referralsTotal,
        creditsThisMonth,
        availableCredits: balance.availableCredits,
        approvedAds,
        linkOpens: clickCounts.open ?? 0,
        shareTaps: clickCounts.share_tap ?? 0,
      },
      actions: actions.map((a) => ({
        id: a.id,
        action: a.action,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
        adminName: a.admin.name,
      })),
    };
  }

  async funnel(sinceDays?: number): Promise<ReferralFunnelDto> {
    const since = sinceDays ? new Date(Date.now() - sinceDays * DAY_MS) : undefined;
    const after = since ? { gte: since } : { not: null };
    const signedUpSince = since ? { signedUpAt: { gte: since } } : {};
    const now = new Date();

    const [clicks, signups, firstAdApproved, rewarded, flagged, reversed, redeemed, revoked, expired, skipped] =
      await Promise.all([
        this.prisma.referralClick.count({ where: since ? { createdAt: { gte: since } } : {} }),
        this.prisma.referral.count({ where: signedUpSince }),
        this.prisma.referral.count({ where: { firstAdApprovedAt: after } }),
        this.prisma.referral.count({ where: { rewardedAt: after } }),
        this.prisma.referral.count({ where: { status: 'blocked', ...signedUpSince } }),
        this.prisma.referral.count({ where: { status: 'reversed', ...signedUpSince } }),
        this.prisma.referralCreditBatch.count({ where: { redeemedAt: after } }),
        this.prisma.referralCreditBatch.count({ where: { revokedAt: after } }),
        this.prisma.referralCreditBatch.count({
          where: {
            redeemedAt: null,
            revokedAt: null,
            expiresAt: since ? { gte: since, lt: now } : { lt: now },
          },
        }),
        this.prisma.referral.groupBy({
          by: ['rewardSkippedReason'],
          where: { rewardSkippedReason: { not: null }, firstAdApprovedAt: after },
          _count: { _all: true },
        }),
      ]);

    const skippedByReason: Record<string, number> = {};
    for (const g of skipped) if (g.rewardSkippedReason) skippedByReason[g.rewardSkippedReason] = g._count._all;

    return {
      sinceDays: sinceDays ?? null,
      clicks,
      signups,
      firstAdApproved,
      rewarded,
      flagged,
      reversed,
      creditsRedeemed: redeemed,
      creditsRevoked: revoked,
      creditsExpired: expired,
      skippedByReason,
    };
  }

  /** Clears a same-device flag after review. If the first ad was already approved, the other
   * rules are applied now and the credit granted if they pass; otherwise the referral goes back
   * to waiting for its first ad, which will be judged normally. */
  async approve(id: string, adminId: string, note?: string): Promise<AdminReferralDetailDto> {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      select: { id: true, status: true, referrerId: true, referredUserId: true, firstAdApprovedAt: true },
    });
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status !== 'blocked') throw new BadRequestException('Only a flagged referral can be approved');

    const decided = referral.firstAdApprovedAt !== null;
    let skipReason: string | null = null;
    let phone: string | null = null;
    if (decided) {
      const referred = await this.prisma.user.findUnique({
        where: { id: referral.referredUserId },
        select: { phone: true },
      });
      phone = referred?.phone ?? null;
      skipReason = await this.referrals.rewardSkipReason({ status: 'ad_approved', referrerId: referral.referrerId }, phone);
    }

    await this.prisma.$transaction([
      this.prisma.referral.update({
        where: { id },
        data: { status: decided ? 'ad_approved' : 'signed_up', rewardSkippedReason: skipReason },
      }),
      this.prisma.referralAdminAction.create({
        data: { adminId, targetUserId: referral.referrerId, referralId: id, action: 'approve_flag', note: note ?? null },
      }),
    ]);
    if (decided && !skipReason && phone) {
      await this.referrals.grantReward(id, referral.referrerId, this.referrals.hashPhone(phone));
    }
    return this.detail(id);
  }

  /** Rejects a referral: it stops counting as a success and its credit is revoked if unused. A
   * credit already spent on a boost is not clawed back (same rule as BR-5). The phone stays in the
   * BR-2 ledger. */
  async reverse(id: string, adminId: string, reason: string): Promise<AdminReferralDetailDto> {
    const referral = await this.prisma.referral.findUnique({ where: { id }, select: { status: true, referrerId: true } });
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status === 'reversed') throw new BadRequestException('Referral is already reversed');

    const [, revoked] = await this.prisma.$transaction([
      this.prisma.referral.update({ where: { id }, data: { status: 'reversed' } }),
      this.prisma.referralCreditBatch.updateMany({
        where: { referralId: id, redeemedAt: null, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: `Reversed by admin: ${reason}` },
      }),
      this.prisma.referralAdminAction.create({
        data: { adminId, targetUserId: referral.referrerId, referralId: id, action: 'reverse', note: reason },
      }),
    ]);
    if (revoked.count > 0) void this.notifier.creditRevoked(referral.referrerId);
    return this.detail(id);
  }

  /** BR-9: the user earns no new referral credits while frozen; credits already granted stay
   * spendable. */
  async freeze(userId: string, adminId: string, reason: string): Promise<void> {
    await this.requireUser(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { referralFrozenAt: new Date(), referralFrozenReason: reason },
      }),
      this.prisma.referralAdminAction.create({
        data: { adminId, targetUserId: userId, action: 'freeze', note: reason },
      }),
    ]);
  }

  async unfreeze(userId: string, adminId: string, note?: string): Promise<void> {
    await this.requireUser(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { referralFrozenAt: null, referralFrozenReason: null },
      }),
      this.prisma.referralAdminAction.create({
        data: { adminId, targetUserId: userId, action: 'unfreeze', note: note ?? null },
      }),
    ]);
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }
}
