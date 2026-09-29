import { ContactRevealService } from './contact-reveal.service';
import { PrismaService } from '../prisma/prisma.service';

const BULK = '9000000002';

function makeService(
  opts: { ownerPhone?: string; alreadyRevealed?: boolean } = {},
) {
  const tx = {
    contactReveal: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.alreadyRevealed ? { id: 'r1' } : null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    contactRevealSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    listing: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          owner: { phone: opts.ownerPhone ?? '9876543210', email: null },
        }),
    },
    contactReveal: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.alreadyRevealed ? { id: 'r1' } : null),
      findMany: jest
        .fn()
        .mockResolvedValue(opts.alreadyRevealed ? [{ listingId: 'l1' }] : []),
      count: jest.fn().mockResolvedValue(0),
    },
    contactRevealSetting: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          freeRevealsPerUser: 3,
          creditPackSize: 10,
          creditPackPriceRupees: 99,
        }),
    },
    contactRevealCreditBatch: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { creditsRemaining: 0 } }),
    },
    $transaction: (run: (t: typeof tx) => unknown) => run(tx),
  } as unknown as PrismaService;
  return { service: new ContactRevealService(prisma), tx };
}

describe('ContactRevealService — unclaimed Bulk Import listings', () => {
  it('refuses a reveal without spending a free reveal or credit', async () => {
    const { service, tx } = makeService({ ownerPhone: BULK });
    await expect(service.revealContact('buyer1', 'l1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'OWNER_UNVERIFIED' },
    });
    expect(tx.contactReveal.create).not.toHaveBeenCalled();
  });

  it('never hands back the placeholder number, even to a buyer who revealed it before this fix', async () => {
    const { service } = makeService({
      ownerPhone: BULK,
      alreadyRevealed: true,
    });
    const state = await service.getRevealState('buyer1', 'l1', BULK, null);
    expect(state).toEqual({
      contactRevealed: false,
      ownerPhone: null,
      ownerEmail: null,
    });

    const states = await service.getRevealStatesForListings('buyer1', [
      { id: 'l1', ownerPhone: BULK, ownerEmail: null },
    ]);
    expect(states.get('l1')).toEqual({
      contactRevealed: false,
      ownerPhone: null,
      ownerEmail: null,
    });
  });

  it('still reveals a real owner', async () => {
    const { service, tx } = makeService();
    await expect(service.revealContact('buyer1', 'l1')).resolves.toEqual({
      ownerPhone: '9876543210',
      ownerEmail: null,
    });
    expect(tx.contactReveal.create).toHaveBeenCalled();
  });
});
