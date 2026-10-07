import { AccountMergeService } from './account-merge.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccountMergeSummary } from '@bhavano/types';

function summary(
  overrides: Partial<AccountMergeSummary> = {},
): AccountMergeSummary {
  return {
    listings: 0,
    activeSubscription: false,
    payments: 0,
    conversations: 0,
    favourites: 0,
    ...overrides,
  };
}

/** Records every write the merge issues, so ordering and payloads can be asserted — this is the
 * riskiest code in the app (it relocates listings and payment records), and the failures that
 * matter are silent ones. */
/** Structural shape of the Prisma call arguments this spec asserts on — enough to read
 * where/data without reaching for `any` at every call site. */
type PrismaArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

function makeTx() {
  const calls: { model: string; args: PrismaArgs }[] = [];
  const record = (model: string) =>
    jest.fn((args: PrismaArgs) => {
      calls.push({ model, args });
      return Promise.resolve({ count: 0 });
    });

  const tx = {
    calls,
    favourite: {
      findMany: jest.fn().mockResolvedValue([{ listingId: 'shared-listing' }]),
      deleteMany: record('favourite.deleteMany'),
      updateMany: record('favourite.updateMany'),
    },
    listingInterest: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: record('listingInterest.deleteMany'),
      updateMany: record('listingInterest.updateMany'),
    },
    contactReveal: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: record('contactReveal.deleteMany'),
      updateMany: record('contactReveal.updateMany'),
    },
    proBoostCredit: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: record('proBoostCredit.deleteMany'),
      updateMany: record('proBoostCredit.updateMany'),
    },
    blockedUser: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: record('blockedUser.deleteMany'),
      updateMany: record('blockedUser.updateMany'),
    },
    listing: { updateMany: record('listing.updateMany') },
    message: { updateMany: record('message.updateMany') },
    conversation: { updateMany: record('conversation.updateMany') },
    payment: { updateMany: record('payment.updateMany') },
    userSubscription: { updateMany: record('userSubscription.updateMany') },
    savedSearch: { updateMany: record('savedSearch.updateMany') },
    loginEvent: { updateMany: record('loginEvent.updateMany') },
    visit: { updateMany: record('visit.updateMany') },
    supportTicket: { updateMany: record('supportTicket.updateMany') },
    outreachCampaign: { updateMany: record('outreachCampaign.updateMany') },
    outreachContact: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: record('outreachContact.updateMany'),
    },
    requirement: { updateMany: record('requirement.updateMany') },
    pushToken: { updateMany: record('pushToken.updateMany') },
    contactRevealCreditBatch: { updateMany: record('contactRevealCreditBatch.updateMany') },
    discountCodeRedemption: { updateMany: record('discountCodeRedemption.updateMany') },
    listingEditLog: { updateMany: record('listingEditLog.updateMany') },
    userNotificationLog: { updateMany: record('userNotificationLog.updateMany') },
    searchEvent: { updateMany: record('searchEvent.updateMany') },
    referral: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: record('referral.updateMany'),
    },
    referralClick: { updateMany: record('referralClick.updateMany') },
    referralCreditBatch: { updateMany: record('referralCreditBatch.updateMany') },
    referralAdminAction: { updateMany: record('referralAdminAction.updateMany') },
    user: { update: record('user.update') },
  };
  return tx;
}

const WINNER = {
  id: 'winner',
  phone: '9000000001',
  phoneVerifiedAt: new Date('2026-01-01'),
  email: null,
  emailVerifiedAt: null,
  googleId: null,
  name: 'Chosen Name',
  cityId: 'city-a',
  premiumUntil: new Date('2026-03-01'),
  agentProUntil: null,
  sellerSlotPackUntil: null,
  agentProUnits: 1,
};

const LOSER = {
  id: 'loser',
  phone: null,
  phoneVerifiedAt: null,
  email: 'both@example.com',
  emailVerifiedAt: new Date('2026-02-01'),
  googleId: 'google-123',
  name: 'Google Name',
  cityId: 'city-b',
  premiumUntil: new Date('2026-09-01'),
  agentProUntil: new Date('2026-06-01'),
  sellerSlotPackUntil: null,
  agentProUnits: 3,
};

function makeService(tx: ReturnType<typeof makeTx>) {
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === 'winner' ? WINNER : LOSER),
      ),
    },
    $transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;
  return new AccountMergeService(prisma);
}

describe('AccountMergeService.isEmpty', () => {
  const service = new AccountMergeService({} as PrismaService);

  it('treats an account with nothing as empty', () => {
    expect(service.isEmpty(summary())).toBe(true);
  });

  it.each([
    ['listings', summary({ listings: 1 })],
    ['an active subscription', summary({ activeSubscription: true })],
    ['payments', summary({ payments: 1 })],
    ['conversations', summary({ conversations: 1 })],
  ])('does not treat an account with %s as empty', (_label, s) => {
    expect(service.isEmpty(s)).toBe(false);
  });

  /** Favourites are re-creatable in seconds and involve nobody else, unlike a conversation,
   * whose counterparty never agreed to have their thread moved. */
  it('ignores favourites, so they never trigger a prompt on their own', () => {
    expect(service.isEmpty(summary({ favourites: 25 }))).toBe(true);
  });
});

describe('AccountMergeService.merge', () => {
  it('releases the loser identifiers BEFORE the winner claims them', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const userUpdates = tx.calls.filter((c) => c.model === 'user.update');
    expect(userUpdates).toHaveLength(2);

    // phone/email/googleId are @unique: claiming the loser's email while the loser still holds
    // it fails the constraint and rolls the entire merge back.
    const [first, second] = userUpdates;
    expect(first.args.where?.id).toBe('loser');
    expect(first.args.data?.email).toBeNull();
    expect(second.args.where?.id).toBe('winner');
    expect(second.args.data?.email).toBe('both@example.com');
  });

  it('preserves the released identifiers on the retired row', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const loserUpdate = tx.calls.find(
      (c) => c.model === 'user.update' && c.args.where?.id === 'loser',
    )!;
    expect(loserUpdate.args.data?.mergedEmail).toBe('both@example.com');
    expect(loserUpdate.args.data?.mergedIntoUserId).toBe('winner');
    expect(loserUpdate.args.data?.mergedAt).toBeInstanceOf(Date);
  });

  it('never deletes the losing row', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');
    expect(tx.calls.some((c) => c.model.startsWith('user.delete'))).toBe(false);
  });

  it('takes the LATER of each paid entitlement', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const winnerUpdate = tx.calls.find(
      (c) => c.model === 'user.update' && c.args.where?.id === 'winner',
    )!;
    // The user paid for both; quietly shortening access they bought is the worst outcome here.
    expect(winnerUpdate.args.data?.premiumUntil).toEqual(
      new Date('2026-09-01'),
    );
    expect(winnerUpdate.args.data?.agentProUntil).toEqual(
      new Date('2026-06-01'),
    );
    expect(winnerUpdate.args.data?.agentProUnits).toBe(3);
  });

  it('fills only what the survivor is missing, never overwriting it', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const winnerUpdate = tx.calls.find(
      (c) => c.model === 'user.update' && c.args.where?.id === 'winner',
    )!;
    expect(winnerUpdate.args.data?.phone).toBe('9000000001'); // winner's own, kept
    expect(winnerUpdate.args.data?.name).toBe('Chosen Name'); // a name they set beats Google's
    expect(winnerUpdate.args.data?.googleId).toBe('google-123'); // winner had none
  });

  it('drops the duplicate favourite before repointing, since (userId, listingId) is unique', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const deleteIdx = tx.calls.findIndex(
      (c) => c.model === 'favourite.deleteMany',
    );
    const updateIdx = tx.calls.findIndex(
      (c) => c.model === 'favourite.updateMany',
    );
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeLessThan(updateIdx);
    expect(
      (tx.calls[deleteIdx].args.where?.listingId as { in: string[] }).in,
    ).toContain('shared-listing');
  });

  it('moves both sides of a conversation', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const convo = tx.calls.filter((c) => c.model === 'conversation.updateMany');
    expect(convo).toHaveLength(2);
    expect(convo[0].args.where).toHaveProperty('posterId', 'loser');
    expect(convo[1].args.where).toHaveProperty('inquirerId', 'loser');
  });

  it('leaves a colliding 1:1 outreachContact on the retired row', async () => {
    const tx = makeTx();
    tx.outreachContact.findUnique.mockResolvedValue({ userId: 'winner' });
    await makeService(tx).merge('winner', 'loser');
    expect(tx.calls.some((c) => c.model === 'outreachContact.updateMany')).toBe(
      false,
    );
  });

  it('leaves a colliding 1:1 referral-as-referred on the retired row', async () => {
    const tx = makeTx();
    tx.referral.findUnique.mockResolvedValue({ referredUserId: 'winner' });
    await makeService(tx).merge('winner', 'loser');
    // referral.updateMany is also called unconditionally for referrerId (referrals the loser
    // made, a separate relation) — only the referredUserId-keyed call should be suppressed.
    expect(tx.calls.some((c) => c.model === 'referral.updateMany' && 'referredUserId' in (c.args.where ?? {}))).toBe(
      false,
    );
  });

  it('repoints the referral-as-referred when only the loser has one', async () => {
    const tx = makeTx();
    tx.referral.findUnique.mockResolvedValue(null);
    await makeService(tx).merge('winner', 'loser');
    const update = tx.calls.find((c) => c.model === 'referral.updateMany' && 'referredUserId' in (c.args.where ?? {}));
    expect(update?.args.where).toEqual({ referredUserId: 'loser' });
    expect(update?.args.data).toEqual({ referredUserId: 'winner' });
  });

  it.each([
    ['listingInterest', 'listingId'],
    ['contactReveal', 'listingId'],
    ['proBoostCredit', 'monthKey'],
  ])('drops the duplicate %s before repointing, since it is unique per user', async (model, key) => {
    const tx = makeTx();
    (tx as unknown as Record<string, { findMany: jest.Mock }>)[model].findMany.mockResolvedValue([{ [key]: 'shared' }]);
    await makeService(tx).merge('winner', 'loser');

    const deleteIdx = tx.calls.findIndex((c) => c.model === `${model}.deleteMany`);
    const updateIdx = tx.calls.findIndex((c) => c.model === `${model}.updateMany`);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeLessThan(updateIdx);
    expect((tx.calls[deleteIdx].args.where?.[key] as { in: string[] }).in).toContain('shared');
  });

  it('drops a self-block in either direction, since both sides become the same account', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');
    const selfBlockDelete = tx.calls.find(
      (c) =>
        c.model === 'blockedUser.deleteMany' &&
        (c.args.where as { OR?: unknown[] })?.OR?.length === 2,
    );
    expect(selfBlockDelete).toBeDefined();
  });

  it('drops the duplicate block of a shared third party before repointing either direction', async () => {
    const tx = makeTx();
    tx.blockedUser.findMany
      .mockResolvedValueOnce([{ blockedId: 'third-party' }]) // winner's own blocks
      .mockResolvedValueOnce([]); // who blocked winner
    await makeService(tx).merge('winner', 'loser');

    const dedupDelete = tx.calls.find(
      (c) => c.model === 'blockedUser.deleteMany' && (c.args.where as { blockerId?: string })?.blockerId === 'loser',
    );
    expect((dedupDelete?.args.where as { blockedId: { in: string[] } }).blockedId.in).toContain('third-party');

    const blockerMove = tx.calls.find(
      (c) => c.model === 'blockedUser.updateMany' && (c.args.where as { blockerId?: string })?.blockerId === 'loser',
    );
    const blockedMove = tx.calls.find(
      (c) => c.model === 'blockedUser.updateMany' && (c.args.where as { blockedId?: string })?.blockedId === 'loser',
    );
    expect(blockerMove).toBeDefined();
    expect(blockedMove).toBeDefined();
  });

  it('moves the rest of the account — requirements, contact-reveal credits, referrals, and the rest', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    for (const model of [
      'requirement',
      'pushToken',
      'contactRevealCreditBatch',
      'discountCodeRedemption',
      'listingEditLog',
      'userNotificationLog',
      'searchEvent',
      'referralClick',
      'referralCreditBatch',
      'referralAdminAction',
    ]) {
      expect(tx.calls.some((c) => c.model === `${model}.updateMany`)).toBe(true);
    }
  });

  it('does nothing when both ids are the same', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'winner');
    expect(tx.calls).toHaveLength(0);
  });
});

describe('AccountMergeService.mergeAsAdmin', () => {
  function makeAdminService(overrides: { winner?: Record<string, unknown>; loser?: Record<string, unknown> } = {}) {
    const tx = makeTx();
    const users: Record<string, Record<string, unknown>> = {
      winner: { ...WINNER, role: 'user', mergedIntoUserId: null, deletedAt: null, ...overrides.winner },
      loser: { ...LOSER, role: 'user', mergedIntoUserId: null, deletedAt: null, ...overrides.loser },
    };
    const userMergeActionCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(users[where.id] ?? null)),
      },
      userMergeAction: { create: userMergeActionCreate },
      $transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    return { service: new AccountMergeService(prisma), tx, userMergeActionCreate };
  }

  it('merges and logs who did it, which two accounts, and why', async () => {
    const { service, tx, userMergeActionCreate } = makeAdminService();
    await service.mergeAsAdmin('admin1', 'winner', 'loser', 'Same person, two logins — confirmed by phone');

    expect(tx.calls.some((c) => c.model === 'listing.updateMany')).toBe(true);
    expect(userMergeActionCreate).toHaveBeenCalledWith({
      data: { adminId: 'admin1', winnerId: 'winner', loserId: 'loser', reason: 'Same person, two logins — confirmed by phone' },
    });
  });

  it('refuses to merge an account into itself', async () => {
    const { service } = makeAdminService();
    await expect(service.mergeAsAdmin('admin1', 'winner', 'winner')).rejects.toThrow(/different accounts/);
  });

  it.each([
    ['winner', { winner: { role: 'admin' } }],
    ['loser', { loser: { role: 'admin' } }],
  ])('refuses when the %s account is staff', async (_label, overrides) => {
    const { service } = makeAdminService(overrides);
    await expect(service.mergeAsAdmin('admin1', 'winner', 'loser')).rejects.toThrow(/Staff accounts/);
  });

  it.each([
    ['winner already merged', { winner: { mergedIntoUserId: 'someone-else' } }],
    ['loser already merged', { loser: { mergedIntoUserId: 'someone-else' } }],
    ['winner self-deleted', { winner: { deletedAt: new Date() } }],
    ['loser self-deleted', { loser: { deletedAt: new Date() } }],
  ])('refuses when %s', async (_label, overrides) => {
    const { service } = makeAdminService(overrides);
    await expect(service.mergeAsAdmin('admin1', 'winner', 'loser')).rejects.toThrow(/already been merged or deleted/);
  });

  it('never logs a UserMergeAction when the merge is refused', async () => {
    const { service, userMergeActionCreate } = makeAdminService({ winner: { role: 'admin' } });
    await expect(service.mergeAsAdmin('admin1', 'winner', 'loser')).rejects.toThrow();
    expect(userMergeActionCreate).not.toHaveBeenCalled();
  });
});

describe('AccountMergeService.pickWinner', () => {
  function serviceWithSummaries(
    a: AccountMergeSummary,
    b: AccountMergeSummary,
  ) {
    const service = new AccountMergeService({} as PrismaService);
    jest
      .spyOn(service, 'summarize')
      .mockImplementation((id: string) => Promise.resolve(id === 'a' ? a : b));
    return service;
  }

  /** Storefronts are keyed by user id, so retiring the account that holds the listings would
   * break its public URL. */
  it('gives it to the account holding more listings', async () => {
    const service = serviceWithSummaries(summary(), summary({ listings: 4 }));
    await expect(service.pickWinner('a', 'b')).resolves.toEqual({
      winnerId: 'b',
      loserId: 'a',
    });
  });

  it('falls back to payment history when listings tie', async () => {
    const service = serviceWithSummaries(
      summary({ payments: 1 }),
      summary({ payments: 9 }),
    );
    await expect(service.pickWinner('a', 'b')).resolves.toEqual({
      winnerId: 'b',
      loserId: 'a',
    });
  });

  it("keeps the caller's own account when nothing separates them", async () => {
    const service = serviceWithSummaries(summary(), summary());
    await expect(service.pickWinner('a', 'b')).resolves.toEqual({
      winnerId: 'a',
      loserId: 'b',
    });
  });
});

describe('AccountMergeService.resolveActiveUserId', () => {
  function serviceWithChain(chain: Record<string, string | null>) {
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({ mergedIntoUserId: chain[where.id] ?? null }),
        ),
      },
    } as unknown as PrismaService;
    return new AccountMergeService(prisma);
  }

  it('returns the id unchanged when the account was never merged', async () => {
    await expect(
      serviceWithChain({ a: null }).resolveActiveUserId('a'),
    ).resolves.toBe('a');
  });

  it('follows the chain to the surviving account', async () => {
    const service = serviceWithChain({ a: 'b', b: 'c', c: null });
    await expect(service.resolveActiveUserId('a')).resolves.toBe('c');
  });

  it('gives up rather than hanging on a cycle', async () => {
    const service = serviceWithChain({ a: 'b', b: 'a' });
    await expect(service.resolveActiveUserId('a')).resolves.toBeDefined();
  });
});
