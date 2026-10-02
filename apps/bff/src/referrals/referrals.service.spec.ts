import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';

function makeService(opts: {
  referrerExists?: boolean;
  alreadyAttributed?: boolean;
  matchingClick?: { createdAt: Date } | null;
  settings?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.referrerExists === false ? null : { id: 'referrer1' }),
    },
    referral: {
      findUnique: jest.fn().mockResolvedValue(opts.alreadyAttributed ? { id: 'existing' } : null),
      create: jest.fn().mockResolvedValue({}),
    },
    referralClick: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(opts.matchingClick ?? null),
    },
    // null falls back to DEFAULT_REFERRAL_SETTINGS (getSettings), same as a real singleton row
    // that hasn't been created/edited yet.
    referralSetting: {
      findUnique: jest.fn().mockResolvedValue(opts.settings ?? null),
    },
  };
  const service = new ReferralsService(prisma as unknown as PrismaService);
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
    const service = new ReferralsService(prisma as unknown as PrismaService);
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
  });

  it('is idempotent — a referral that already has a credit batch is never granted twice', async () => {
    const { service, prisma } = makeGrantService({ existingBatch: { id: 'batch1' } });
    await service.grantReward('referral1', 'referrer1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.referralCreditBatch.create).not.toHaveBeenCalled();
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
    const service = new ReferralsService(prisma as unknown as PrismaService);
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
