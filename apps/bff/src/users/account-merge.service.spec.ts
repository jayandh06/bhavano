import { AccountMergeService } from './account-merge.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccountMergeSummary } from '@bhavano/types';

function summary(overrides: Partial<AccountMergeSummary> = {}): AccountMergeSummary {
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
function makeTx() {
  const calls: { model: string; args: unknown }[] = [];
  const record = (model: string) =>
    jest.fn((args: unknown) => {
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
    listing: { updateMany: record('listing.updateMany') },
    message: { updateMany: record('message.updateMany') },
    conversation: { updateMany: record('conversation.updateMany') },
    payment: { updateMany: record('payment.updateMany') },
    userSubscription: { updateMany: record('userSubscription.updateMany') },
    savedSearch: { updateMany: record('savedSearch.updateMany') },
    proBoostCredit: { updateMany: record('proBoostCredit.updateMany') },
    loginEvent: { updateMany: record('loginEvent.updateMany') },
    visit: { updateMany: record('visit.updateMany') },
    supportTicket: { updateMany: record('supportTicket.updateMany') },
    outreachCampaign: { updateMany: record('outreachCampaign.updateMany') },
    outreachContact: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: record('outreachContact.updateMany'),
    },
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
    const [first, second] = userUpdates as [{ args: any }, { args: any }];
    expect(first.args.where.id).toBe('loser');
    expect(first.args.data.email).toBeNull();
    expect(second.args.where.id).toBe('winner');
    expect(second.args.data.email).toBe('both@example.com');
  });

  it('preserves the released identifiers on the retired row', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const loserUpdate = tx.calls.find(
      (c) => c.model === 'user.update' && (c.args as any).where.id === 'loser',
    ) as { args: any };
    expect(loserUpdate.args.data.mergedEmail).toBe('both@example.com');
    expect(loserUpdate.args.data.mergedIntoUserId).toBe('winner');
    expect(loserUpdate.args.data.mergedAt).toBeInstanceOf(Date);
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
      (c) => c.model === 'user.update' && (c.args as any).where.id === 'winner',
    ) as { args: any };
    // The user paid for both; quietly shortening access they bought is the worst outcome here.
    expect(winnerUpdate.args.data.premiumUntil).toEqual(new Date('2026-09-01'));
    expect(winnerUpdate.args.data.agentProUntil).toEqual(new Date('2026-06-01'));
    expect(winnerUpdate.args.data.agentProUnits).toBe(3);
  });

  it('fills only what the survivor is missing, never overwriting it', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const winnerUpdate = tx.calls.find(
      (c) => c.model === 'user.update' && (c.args as any).where.id === 'winner',
    ) as { args: any };
    expect(winnerUpdate.args.data.phone).toBe('9000000001'); // winner's own, kept
    expect(winnerUpdate.args.data.name).toBe('Chosen Name'); // a name they set beats Google's
    expect(winnerUpdate.args.data.googleId).toBe('google-123'); // winner had none
  });

  it('drops the duplicate favourite before repointing, since (userId, listingId) is unique', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const deleteIdx = tx.calls.findIndex((c) => c.model === 'favourite.deleteMany');
    const updateIdx = tx.calls.findIndex((c) => c.model === 'favourite.updateMany');
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeLessThan(updateIdx);
    expect((tx.calls[deleteIdx].args as any).where.listingId.in).toContain('shared-listing');
  });

  it('moves both sides of a conversation', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'loser');

    const convo = tx.calls.filter((c) => c.model === 'conversation.updateMany');
    expect(convo).toHaveLength(2);
    expect((convo[0].args as any).where).toHaveProperty('posterId', 'loser');
    expect((convo[1].args as any).where).toHaveProperty('inquirerId', 'loser');
  });

  it('leaves a colliding 1:1 outreachContact on the retired row', async () => {
    const tx = makeTx();
    tx.outreachContact.findUnique.mockResolvedValue({ userId: 'winner' });
    await makeService(tx).merge('winner', 'loser');
    expect(tx.calls.some((c) => c.model === 'outreachContact.updateMany')).toBe(false);
  });

  it('does nothing when both ids are the same', async () => {
    const tx = makeTx();
    await makeService(tx).merge('winner', 'winner');
    expect(tx.calls).toHaveLength(0);
  });
});

describe('AccountMergeService.pickWinner', () => {
  function serviceWithSummaries(a: AccountMergeSummary, b: AccountMergeSummary) {
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
    const service = serviceWithSummaries(summary({ payments: 1 }), summary({ payments: 9 }));
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
    await expect(serviceWithChain({ a: null }).resolveActiveUserId('a')).resolves.toBe('a');
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
