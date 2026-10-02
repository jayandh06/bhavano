import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralsAdminService } from './referrals-admin.service';
import type { ReferralsService } from './referrals.service';
import type { ReferralNotificationsService } from './referral-notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService(opts: {
  referral?: Record<string, unknown> | null;
  referredPhone?: string | null;
  userExists?: boolean;
  skipReason?: string | null;
  clicksByKind?: { kind: string; _count: { _all: number } }[];
  mockDetail?: boolean;
} = {}) {
  const prisma = {
    referral: {
      findUnique: jest.fn().mockResolvedValue(opts.referral ?? null),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    referralCreditBatch: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    referralClick: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue(opts.clicksByKind ?? []),
    },
    referralAdminAction: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    listing: { count: jest.fn().mockResolvedValue(0) },
    user: {
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve(opts.userExists === false ? null : { id: 'u1', phone: opts.referredPhone ?? null }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const referrals = {
    rewardSkipReason: jest.fn().mockResolvedValue(opts.skipReason ?? null),
    grantReward: jest.fn().mockResolvedValue(undefined),
    hashPhone: jest.fn((phone: string) => `hash:${phone}`),
    getBalanceForUser: jest.fn().mockResolvedValue({ availableCredits: 0 }),
  };
  const notifier = { creditRevoked: jest.fn().mockResolvedValue(undefined) };
  const service = new ReferralsAdminService(
    prisma as unknown as PrismaService,
    referrals as unknown as ReferralsService,
    notifier as unknown as ReferralNotificationsService,
  );
  if (opts.mockDetail !== false) {
    jest.spyOn(service, 'detail').mockResolvedValue({} as never);
  }
  return { service, prisma, referrals, notifier };
}

const blocked = { id: 'ref1', status: 'blocked', referrerId: 'referrer1', referredUserId: 'u1' };

describe('ReferralsAdminService.approve', () => {
  it('refuses a referral that is not flagged', async () => {
    const { service } = makeService({ referral: { ...blocked, status: 'rewarded', firstAdApprovedAt: null } });
    await expect(service.approve('ref1', 'admin1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s an unknown referral', async () => {
    const { service } = makeService({ referral: null });
    await expect(service.approve('nope', 'admin1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sends a flag with no approved ad yet back to waiting, without granting', async () => {
    const { service, prisma, referrals } = makeService({ referral: { ...blocked, firstAdApprovedAt: null } });
    await service.approve('ref1', 'admin1', 'family member, different phones');
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'ref1' },
      data: { status: 'signed_up', rewardSkippedReason: null },
    });
    expect(prisma.referralAdminAction.create).toHaveBeenCalledWith({
      data: {
        adminId: 'admin1',
        targetUserId: 'referrer1',
        referralId: 'ref1',
        action: 'approve_flag',
        note: 'family member, different phones',
      },
    });
    expect(referrals.rewardSkipReason).not.toHaveBeenCalled();
    expect(referrals.grantReward).not.toHaveBeenCalled();
  });

  it('grants the credit when the first ad is already approved and the other rules pass', async () => {
    const { service, prisma, referrals } = makeService({
      referral: { ...blocked, firstAdApprovedAt: new Date() },
      referredPhone: '+919800000001',
    });
    await service.approve('ref1', 'admin1');
    expect(referrals.rewardSkipReason).toHaveBeenCalledWith(
      { status: 'ad_approved', referrerId: 'referrer1' },
      '+919800000001',
    );
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'ref1' },
      data: { status: 'ad_approved', rewardSkippedReason: null },
    });
    expect(referrals.grantReward).toHaveBeenCalledWith('ref1', 'referrer1', 'hash:+919800000001');
  });

  it('records the remaining rule that still blocks the reward instead of granting', async () => {
    const { service, prisma, referrals } = makeService({
      referral: { ...blocked, firstAdApprovedAt: new Date() },
      referredPhone: '+919800000001',
      skipReason: 'monthly_cap',
    });
    await service.approve('ref1', 'admin1');
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'ref1' },
      data: { status: 'ad_approved', rewardSkippedReason: 'monthly_cap' },
    });
    expect(referrals.grantReward).not.toHaveBeenCalled();
  });
});

describe('ReferralsAdminService.reverse', () => {
  it('refuses to reverse twice', async () => {
    const { service } = makeService({ referral: { status: 'reversed', referrerId: 'referrer1' } });
    await expect(service.reverse('ref1', 'admin1', 'fake account')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks the referral reversed, revokes only an unspent credit, and logs the reason', async () => {
    const { service, prisma, notifier } = makeService({ referral: { status: 'rewarded', referrerId: 'referrer1' } });
    await service.reverse('ref1', 'admin1', 'fake account');
    expect(notifier.creditRevoked).toHaveBeenCalledWith('referrer1');
    expect(prisma.referral.update).toHaveBeenCalledWith({ where: { id: 'ref1' }, data: { status: 'reversed' } });
    expect(prisma.referralCreditBatch.updateMany).toHaveBeenCalledWith({
      where: { referralId: 'ref1', redeemedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date), revokedReason: 'Reversed by admin: fake account' },
    });
    expect(prisma.referralAdminAction.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', targetUserId: 'referrer1', referralId: 'ref1', action: 'reverse', note: 'fake account' },
    });
  });
});

describe('ReferralsAdminService freeze/unfreeze', () => {
  it('freezes with a reason and logs it', async () => {
    const { service, prisma } = makeService();
    await service.freeze('referrer1', 'admin1', 'ring of fake accounts');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'referrer1' },
      data: { referralFrozenAt: expect.any(Date), referralFrozenReason: 'ring of fake accounts' },
    });
    expect(prisma.referralAdminAction.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', targetUserId: 'referrer1', action: 'freeze', note: 'ring of fake accounts' },
    });
  });

  it('unfreezes and clears the reason', async () => {
    const { service, prisma } = makeService();
    await service.unfreeze('referrer1', 'admin1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'referrer1' },
      data: { referralFrozenAt: null, referralFrozenReason: null },
    });
    expect(prisma.referralAdminAction.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', targetUserId: 'referrer1', action: 'unfreeze', note: null },
    });
  });

  it('404s an unknown user without writing anything', async () => {
    const { service, prisma } = makeService({ userExists: false });
    await expect(service.freeze('nope', 'admin1', 'reason')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.referralAdminAction.create).not.toHaveBeenCalled();
  });
});

describe('ReferralsAdminService.funnel', () => {
  it('groups skipped rewards by reason', async () => {
    const { service, prisma } = makeService();
    prisma.referral.groupBy.mockResolvedValue([
      { rewardSkippedReason: 'monthly_cap', _count: { _all: 2 } },
      { rewardSkippedReason: 'same_device', _count: { _all: 1 } },
    ]);
    const funnel = await service.funnel(30);
    expect(funnel.sinceDays).toBe(30);
    expect(funnel.skippedByReason).toEqual({ monthly_cap: 2, same_device: 1 });
  });

  it('reports all time when no window is given', async () => {
    const { service } = makeService();
    const funnel = await service.funnel();
    expect(funnel.sinceDays).toBeNull();
  });
});

const detailRow = {
  id: 'ref1',
  status: 'rewarded',
  rewardSkippedReason: null,
  referrerId: 'referrer1',
  referrer: {
    id: 'referrer1',
    name: 'Referrer',
    phone: '9000000001',
    referralFrozenAt: null,
    referralFrozenReason: null,
  },
  referredUser: { id: 'u1', name: 'Referred', phone: '9000000002' },
  clickedAt: null,
  signedUpAt: new Date('2026-01-01'),
  firstAdApprovedAt: null,
  rewardedAt: null,
  creditBatch: null,
};

describe('ReferralsAdminService.detail', () => {
  it('surfaces link-open and share-tap counts for the referrer, keyed off ReferralClick.kind', async () => {
    const { service, prisma } = makeService({
      referral: detailRow,
      mockDetail: false,
      clicksByKind: [
        { kind: 'open', _count: { _all: 4 } },
        { kind: 'share_tap', _count: { _all: 7 } },
      ],
    });
    const result = await service.detail('ref1');
    expect(prisma.referralClick.groupBy).toHaveBeenCalledWith({
      by: ['kind'],
      where: { referrerId: 'referrer1' },
      _count: { _all: true },
    });
    expect(result.referrerStats.linkOpens).toBe(4);
    expect(result.referrerStats.shareTaps).toBe(7);
  });

  it('defaults both counts to 0 when the referrer has no clicks of either kind', async () => {
    const { service } = makeService({
      referral: detailRow,
      mockDetail: false,
      clicksByKind: [],
    });
    const result = await service.detail('ref1');
    expect(result.referrerStats.linkOpens).toBe(0);
    expect(result.referrerStats.shareTaps).toBe(0);
  });

  it('404s an unknown referral', async () => {
    const { service } = makeService({ referral: null, mockDetail: false });
    await expect(service.detail('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
