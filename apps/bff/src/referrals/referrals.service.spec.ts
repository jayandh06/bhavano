import type { ConfigService } from '@nestjs/config';
import { ReferralsService, istMonthStart } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ReferralNotificationsService } from './referral-notifications.service';

const config = { get: () => 'test-secret' } as unknown as ConfigService;
const notifierMock = {
  referralSignedUp: jest.fn().mockResolvedValue(undefined),
  rewardGranted: jest.fn().mockResolvedValue(undefined),
  creditRevoked: jest.fn().mockResolvedValue(undefined),
};
const notifier = notifierMock as unknown as ReferralNotificationsService;

beforeEach(() => {
  Object.values(notifierMock).forEach((fn) => fn.mockClear());
});

function makeService(opts: {
  referrerExists?: boolean;
  referrerViewerKey?: string | null;
  newUserPhone?: string | null;
  phoneAlreadyRewarded?: boolean;
  alreadyAttributed?: boolean;
  matchingClick?: { createdAt: Date } | null;
  settings?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'newUser1') return Promise.resolve({ phone: opts.newUserPhone ?? null });
        if (opts.referrerExists === false) return Promise.resolve(null);
        return Promise.resolve({ id: 'referrer1', firstSeenViewerKey: opts.referrerViewerKey ?? null });
      }),
    },
    referral: {
      findUnique: jest.fn().mockResolvedValue(opts.alreadyAttributed ? { id: 'existing' } : null),
      create: jest.fn().mockResolvedValue({}),
    },
    referralClick: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(opts.matchingClick ?? null),
    },
    referralPhoneLedger: {
      findUnique: jest.fn().mockResolvedValue(opts.phoneAlreadyRewarded ? { id: 'ledger1' } : null),
    },
    // null falls back to DEFAULT_REFERRAL_SETTINGS (getSettings), same as a real singleton row
    // that hasn't been created/edited yet.
    referralSetting: {
      findUnique: jest.fn().mockResolvedValue(opts.settings ?? null),
    },
  };
  const service = new ReferralsService(prisma as unknown as PrismaService, config, notifier);
  return { service, prisma };
}

describe('ReferralsService.recordClick', () => {
  it('records a click for a real referrer', async () => {
    const { service, prisma } = makeService({ referrerExists: true });
    await service.recordClick('referrer1', 'sess1', 'listing1');
    expect(prisma.referralClick.create).toHaveBeenCalledWith({
      data: { referrerId: 'referrer1', sessionId: 'sess1', landingListingId: 'listing1' },
    });
  });

  it('silently does nothing for an unknown referrer id — never errors back to an anonymous caller', async () => {
    const { service, prisma } = makeService({ referrerExists: false });
    await service.recordClick('not-a-real-user', 'sess1');
    expect(prisma.referralClick.create).not.toHaveBeenCalled();
  });
});

describe('ReferralsService.attributeSignupIfReferred', () => {
  it('attributes a new signup to the referrer, carrying over a matching click timestamp', async () => {
    const clickedAt = new Date('2026-10-01T00:00:00Z');
    const { service, prisma } = makeService({ referrerExists: true, matchingClick: { createdAt: clickedAt } });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerId: 'referrer1', referredUserId: 'newUser1', clickedAt },
    });
    expect(notifierMock.referralSignedUp).toHaveBeenCalledWith('referrer1', null);
  });

  it('attributes with no clickedAt when no matching click was ever recorded', async () => {
    const { service, prisma } = makeService({ referrerExists: true, matchingClick: null });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerId: 'referrer1', referredUserId: 'newUser1', clickedAt: undefined },
    });
  });

  it('is a no-op with no referral code at all', async () => {
    const { service, prisma } = makeService();
    await service.attributeSignupIfReferred('newUser1', undefined, 'sess1');
    expect(prisma.referral.create).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('blocks self-referral — referralCode equal to the new user\'s own id', async () => {
    const { service, prisma } = makeService({ referrerExists: true });
    await service.attributeSignupIfReferred('sameUser', 'sameUser', 'sess1');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('is a no-op for an unknown referrer id', async () => {
    const { service, prisma } = makeService({ referrerExists: false });
    await service.attributeSignupIfReferred('newUser1', 'not-a-real-user', 'sess1');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('is idempotent — a user who already has a referrer is never re-attributed', async () => {
    const { service, prisma } = makeService({ referrerExists: true, alreadyAttributed: true });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referral.create).not.toHaveBeenCalled();
    // Never even looks up the referrer once already attributed — the existence check short-circuits first.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses attribution once a matching click is older than the attribution window', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { service, prisma } = makeService({
      referrerExists: true,
      matchingClick: { createdAt: thirtyOneDaysAgo },
      settings: { attributionWindowDays: 30 },
    });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('still attributes when a matching click is within the attribution window', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const { service, prisma } = makeService({
      referrerExists: true,
      matchingClick: { createdAt: tenDaysAgo },
      settings: { attributionWindowDays: 30 },
    });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerId: 'referrer1', referredUserId: 'newUser1', clickedAt: tenDaysAgo },
    });
  });

  it('never consults settings (no window check) when there is no matching click at all', async () => {
    const { service, prisma } = makeService({ referrerExists: true, matchingClick: null });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referralSetting.findUnique).not.toHaveBeenCalled();
    expect(prisma.referral.create).toHaveBeenCalled();
  });

  it('flags (not refuses) a signup from the referrer\'s own device — BR-3', async () => {
    const { service, prisma } = makeService({ referrerViewerKey: 'device1' });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1', 'device1');
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'blocked', rewardSkippedReason: 'same_device' }),
    });
    expect(notifierMock.referralSignedUp).not.toHaveBeenCalled();
  });

  it('attributes normally from a different device, or when the referrer has no recorded device', async () => {
    for (const referrerViewerKey of ['device2', null]) {
      const { service, prisma } = makeService({ referrerViewerKey });
      await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1', 'device1');
      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: { referrerId: 'referrer1', referredUserId: 'newUser1', clickedAt: undefined },
      });
    }
  });

  it('refuses attribution for a phone that already earned a referral reward — BR-2', async () => {
    const { service, prisma } = makeService({ newUserPhone: '+919876543210', phoneAlreadyRewarded: true });
    await service.attributeSignupIfReferred('newUser1', 'referrer1', 'sess1');
    expect(prisma.referralPhoneLedger.findUnique).toHaveBeenCalledWith({
      where: { phoneHash: service.hashPhone('+919876543210') },
      select: { id: true },
    });
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });
});

describe('ReferralsService.hashPhone / istMonthStart', () => {
  it('hashes a phone deterministically and never returns the raw number', () => {
    const { service } = makeService();
    const hash = service.hashPhone('+919876543210');
    expect(hash).toBe(service.hashPhone('+919876543210'));
    expect(hash).not.toContain('9876543210');
    expect(hash).not.toBe(service.hashPhone('+919876543211'));
  });

  it('starts the month at midnight India time', () => {
    // 1:30 am IST on 1 Nov is still 31 Oct in UTC — it already belongs to November.
    expect(istMonthStart(new Date('2026-10-31T20:00:00Z')).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(istMonthStart(new Date('2026-10-15T10:00:00Z')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });
});

describe('ReferralsService.recordFirstApprovedAdIfReferred', () => {
  function makeApprovalService(opts: {
    referral?: { status?: string; rewardedAt?: Date | null; firstAdApprovedAt?: Date | null } | null;
    ownerApprovedCount?: number;
    ownerPhone?: string | null;
    phoneAlreadyRewarded?: boolean;
    referrer?: { deletedAt?: Date | null; referralFrozenAt?: Date | null } | null;
    referrerApprovedAds?: number;
    grantedThisMonth?: number;
  } = {}) {
    const referral =
      opts.referral === null
        ? null
        : { id: 'referral1', referrerId: 'referrer1', status: 'signed_up', rewardedAt: null, firstAdApprovedAt: null, ...opts.referral };
    const prisma = {
      referral: {
        findUnique: jest.fn().mockResolvedValue(referral),
        update: jest.fn().mockResolvedValue({}),
      },
      listing: {
        count: jest.fn().mockImplementation(({ where }: { where: { ownerId: string } }) =>
          Promise.resolve(where.ownerId === 'owner1' ? (opts.ownerApprovedCount ?? 1) : (opts.referrerApprovedAds ?? 2)),
        ),
      },
      user: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'owner1'
              ? { phone: opts.ownerPhone === undefined ? '+919876543210' : opts.ownerPhone }
              : opts.referrer === null
                ? null
                : { deletedAt: null, referralFrozenAt: null, ...opts.referrer },
          ),
        ),
      },
      referralPhoneLedger: {
        findUnique: jest.fn().mockResolvedValue(opts.phoneAlreadyRewarded ? { id: 'ledger1' } : null),
        create: jest.fn().mockReturnValue('ledger-create'),
      },
      referralCreditBatch: {
        count: jest.fn().mockResolvedValue(opts.grantedThisMonth ?? 0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue('batch-create'),
      },
      referralSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
    };
    const service = new ReferralsService(prisma as unknown as PrismaService, config, notifier);
    return { service, prisma };
  }

  it('grants the credit and records the referred phone in the ledger, in one transaction', async () => {
    const { service, prisma } = makeApprovalService();
    await service.recordFirstApprovedAdIfReferred('owner1');
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'referral1' },
      data: expect.objectContaining({ status: 'ad_approved', rewardSkippedReason: null }),
    });
    expect(prisma.referralPhoneLedger.create).toHaveBeenCalledWith({
      data: { phoneHash: service.hashPhone('+919876543210'), referralId: 'referral1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['batch-create', expect.anything(), 'ledger-create']);
  });

  it.each([
    ['a same-device flag stays blocked', { referral: { status: 'blocked' } }, 'same_device', 'blocked'],
    ['the phone already earned a reward', { phoneAlreadyRewarded: true }, 'phone_already_rewarded', 'ad_approved'],
    ['the referred user has no phone', { ownerPhone: null }, 'phone_missing', 'ad_approved'],
    ['the referrer account is deleted', { referrer: { deletedAt: new Date() } }, 'referrer_deleted', 'ad_approved'],
    ['the referrer is frozen', { referrer: { referralFrozenAt: new Date() } }, 'referrer_frozen', 'ad_approved'],
    ['the referrer has no approved ad', { referrerApprovedAds: 0 }, 'referrer_no_approved_ad', 'ad_approved'],
    ['the monthly cap is reached', { grantedThisMonth: 5 }, 'monthly_cap', 'ad_approved'],
  ] as const)('grants nothing when %s', async (_label, opts, reason, status) => {
    const { service, prisma } = makeApprovalService(opts);
    await service.recordFirstApprovedAdIfReferred('owner1');
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'referral1' },
      data: expect.objectContaining({ status, rewardSkippedReason: reason, firstAdApprovedAt: expect.any(Date) }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('counts only base credits from this India-time month toward the cap', async () => {
    const { service, prisma } = makeApprovalService({ grantedThisMonth: 4 });
    await service.recordFirstApprovedAdIfReferred('owner1');
    expect(prisma.referralCreditBatch.count).toHaveBeenCalledWith({
      where: { userId: 'referrer1', bonusTier: null, grantedAt: { gte: istMonthStart() } },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('decides only once — a referral whose first ad was already judged is never re-evaluated', async () => {
    const { service, prisma } = makeApprovalService({ referral: { firstAdApprovedAt: new Date() } });
    await service.recordFirstApprovedAdIfReferred('owner1');
    expect(prisma.referral.update).not.toHaveBeenCalled();
    expect(prisma.listing.count).not.toHaveBeenCalled();
  });

  it('waits until the owner has exactly one approved live ad', async () => {
    const { service, prisma } = makeApprovalService({ ownerApprovedCount: 0 });
    await service.recordFirstApprovedAdIfReferred('owner1');
    expect(prisma.referral.update).not.toHaveBeenCalled();
  });
});

describe('ReferralsService.grantReward', () => {
  function makeGrantService(opts: { existingBatch?: { id: string } | null; settings?: Record<string, unknown> | null } = {}) {
    const prisma = {
      referralCreditBatch: {
        findUnique: jest.fn().mockResolvedValue(opts.existingBatch ?? null),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      referral: { update: jest.fn() },
      referralSetting: { findUnique: jest.fn().mockResolvedValue(opts.settings ?? null) },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    const service = new ReferralsService(prisma as unknown as PrismaService, config, notifier);
    return { service, prisma };
  }

  it('grants a credit batch sized from settings and marks the referral rewarded, atomically', async () => {
    const { service, prisma } = makeGrantService({ settings: { boostDays: 3, creditExpiryDays: 60 } });
    await service.grantReward('referral1', 'referrer1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.referralCreditBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'referrer1', referralId: 'referral1', daysGranted: 3 }),
      }),
    );
    expect(prisma.referral.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'referral1' },
        data: expect.objectContaining({ status: 'rewarded' }),
      }),
    );
    expect(notifierMock.rewardGranted).toHaveBeenCalledWith('referrer1', 3, expect.any(Date));
  });

  it('is idempotent — a referral that already has a credit batch is never granted twice', async () => {
    const { service, prisma } = makeGrantService({ existingBatch: { id: 'batch1' } });
    await service.grantReward('referral1', 'referrer1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.referralCreditBatch.create).not.toHaveBeenCalled();
    expect(notifierMock.rewardGranted).not.toHaveBeenCalled();
  });
});

describe('ReferralsService.findRedeemableCredit / markCreditRedeemed / getBalanceForUser', () => {
  function makeCreditService(batches: { id: string; daysGranted: number; expiresAt: Date }[]) {
    const prisma = {
      referralCreditBatch: {
        // Projects the same fields the real `select: { id, daysGranted }` call does — findMany
        // below asks for `expiresAt` instead, so each mock mirrors its own call site's selection.
        findFirst: jest.fn().mockImplementation(() =>
          Promise.resolve(batches[0] ? { id: batches[0].id, daysGranted: batches[0].daysGranted } : null),
        ),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(batches.map((b) => ({ expiresAt: b.expiresAt })))),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ReferralsService(prisma as unknown as PrismaService, config, notifier);
    return { service, prisma };
  }

  it('finds the credit nearest expiry as redeemable', async () => {
    const soon = { id: 'batch1', daysGranted: 3, expiresAt: new Date(Date.now() + 86_400_000) };
    const { service, prisma } = makeCreditService([soon]);
    const result = await service.findRedeemableCredit('user1');
    expect(result).toEqual({ id: 'batch1', daysGranted: 3 });
    expect(prisma.referralCreditBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { expiresAt: 'asc' } }),
    );
  });

  it('returns null when nothing is redeemable', async () => {
    const { service } = makeCreditService([]);
    expect(await service.findRedeemableCredit('user1')).toBeNull();
  });

  it('marks a credit redeemed with the listing and payment it was spent on', async () => {
    const { service, prisma } = makeCreditService([]);
    await service.markCreditRedeemed('batch1', 'listing1', 'payment1');
    expect(prisma.referralCreditBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch1' },
      data: expect.objectContaining({ redeemedListingId: 'listing1', redeemedPaymentId: 'payment1' }),
    });
  });

  it('reports the available balance and soonest expiry from the ledger', async () => {
    const soon = { id: 'batch1', daysGranted: 3, expiresAt: new Date(Date.now() + 86_400_000) };
    const later = { id: 'batch2', daysGranted: 3, expiresAt: new Date(Date.now() + 2 * 86_400_000) };
    const { service } = makeCreditService([soon, later]);
    expect(await service.getBalanceForUser('user1')).toEqual({ availableCredits: 2, nextExpiryAt: soon.expiresAt });
  });

  it('reports zero balance with no next expiry when nothing is available', async () => {
    const { service } = makeCreditService([]);
    expect(await service.getBalanceForUser('user1')).toEqual({ availableCredits: 0, nextExpiryAt: null });
  });
});

describe('ReferralsService.revokeIfTakenDown', () => {
  function makeRevokeService(opts: { approvedDaysAgo: number; revokedCount: number }) {
    const prisma = {
      referral: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'referral1',
          referrerId: 'referrer1',
          firstAdApprovedAt: new Date(Date.now() - opts.approvedDaysAgo * 86_400_000),
        }),
      },
      referralSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      referralCreditBatch: { updateMany: jest.fn().mockResolvedValue({ count: opts.revokedCount }) },
    };
    return { service: new ReferralsService(prisma as unknown as PrismaService, config, notifier), prisma };
  }

  it('revokes the unused credit inside the window and tells the referrer', async () => {
    const { service, prisma } = makeRevokeService({ approvedDaysAgo: 3, revokedCount: 1 });
    await service.revokeIfTakenDown('owner1', 'flagged');
    expect(prisma.referralCreditBatch.updateMany).toHaveBeenCalled();
    expect(notifierMock.creditRevoked).toHaveBeenCalledWith('referrer1');
  });

  it('says nothing when there was no unused credit to revoke', async () => {
    const { service } = makeRevokeService({ approvedDaysAgo: 3, revokedCount: 0 });
    await service.revokeIfTakenDown('owner1', 'flagged');
    expect(notifierMock.creditRevoked).not.toHaveBeenCalled();
  });

  it('leaves the credit alone past the revocation window', async () => {
    const { service, prisma } = makeRevokeService({ approvedDaysAgo: 30, revokedCount: 1 });
    await service.revokeIfTakenDown('owner1', 'flagged');
    expect(prisma.referralCreditBatch.updateMany).not.toHaveBeenCalled();
  });
});

describe('ReferralsService.getMine', () => {
  function makeMineService() {
    const signedUpAt = new Date('2026-10-01T10:00:00Z');
    const prisma = {
      referralSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      referralCreditBatch: {
        findMany: jest.fn().mockResolvedValue([
          { daysGranted: 3, grantedAt: signedUpAt, expiresAt: new Date('2026-11-30T10:00:00Z') },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      referral: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'signed_up', _count: { _all: 2 } },
          { status: 'ad_approved', _count: { _all: 1 } },
          { status: 'rewarded', _count: { _all: 1 } },
          { status: 'blocked', _count: { _all: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', status: 'rewarded', signedUpAt, rewardedAt: signedUpAt, referredUser: { name: 'Asha Rao Kumar' } },
          { id: 'r2', status: 'signed_up', signedUpAt, rewardedAt: null, referredUser: { name: null } },
        ]),
      },
    };
    return new ReferralsService(prisma as unknown as PrismaService, config, notifier);
  }

  it("returns the code, spendable credits, counts, and only referred users' first names", async () => {
    const mine = await makeMineService().getMine('user1');
    expect(mine.referralCode).toBe('user1');
    expect(mine.boostDays).toBe(3);
    expect(mine.availableCredits).toEqual([
      { daysGranted: 3, grantedAt: '2026-10-01T10:00:00.000Z', expiresAt: '2026-11-30T10:00:00.000Z' },
    ]);
    expect(mine.creditsThisMonth).toBe(1);
    expect(mine.counts).toEqual({ signedUp: 5, firstAdApproved: 2, rewarded: 1 });
    expect(mine.recent.map((r) => r.firstName)).toEqual(['Asha', null]);
  });
});
