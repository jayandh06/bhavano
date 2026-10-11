import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AccountDeletionService } from './account-deletion.service';
import { PrismaService } from '../prisma/prisma.service';

const TEST_SECRET = 'test-secret';

function makeService(user: Record<string, unknown> | null, listings: Record<string, unknown>[]) {
  const tx = {
    listing: {
      findMany: jest.fn().mockResolvedValue(listings),
      updateMany: jest.fn().mockResolvedValue({ count: listings.length }),
    },
    listingEditLog: { createMany: jest.fn() },
    savedSearch: { deleteMany: jest.fn() },
    user: { update: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    $transaction: (run: (t: typeof tx) => unknown) => run(tx),
  } as unknown as PrismaService;
  const config = { get: jest.fn().mockReturnValue(TEST_SECRET) } as unknown as ConfigService;
  return { service: new AccountDeletionService(prisma, config), tx };
}

function expectedHash(value: string): string {
  return createHmac('sha256', TEST_SECRET).update(value).digest('hex');
}

describe('AccountDeletionService.deleteOwnAccount — ListingEditLog for the listings it deactivates', () => {
  it('logs one status_changed row per listing that was not already deactivated', async () => {
    const { service, tx } = makeService({ id: 'u1', deletedAt: null }, [
      { id: 'l1', status: 'active' },
      { id: 'l2', status: 'sold' },
    ]);

    await service.deleteOwnAccount('u1');

    expect(tx.listing.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1', status: { not: 'deactivated' } },
      select: { id: true, status: true },
    });
    expect(tx.listingEditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          listingId: 'l1',
          actorType: 'system',
          actorId: null,
          action: 'status_changed',
          changes: { status: { before: 'active', after: 'deactivated' } },
        },
        {
          listingId: 'l2',
          actorType: 'system',
          actorId: null,
          action: 'status_changed',
          changes: { status: { before: 'sold', after: 'deactivated' } },
        },
      ],
    });
  });

  it('writes no log at all when every listing is already deactivated (or there are none)', async () => {
    const { service, tx } = makeService({ id: 'u1', deletedAt: null }, []);

    await service.deleteOwnAccount('u1');

    expect(tx.listingEditLog.createMany).not.toHaveBeenCalled();
    // Still runs the real deactivation sweep unconditionally — harmless no-op for listings
    // already deactivated, and the one path that must not be skipped even with nothing to log.
    expect(tx.listing.updateMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1' },
      data: { status: 'deactivated' },
    });
  });

  it('is a no-op for an already-deleted account', async () => {
    const { service, tx } = makeService({ id: 'u1', deletedAt: new Date('2026-01-01') }, []);

    await service.deleteOwnAccount('u1');

    expect(tx.listing.findMany).not.toHaveBeenCalled();
  });
});

describe('AccountDeletionService.deleteOwnAccount — deletion fingerprint', () => {
  it('writes a keyed hash of the phone and email being released, not the raw values', async () => {
    const { service, tx } = makeService(
      { id: 'u1', deletedAt: null, phone: '+919999999999', email: 'a@example.com' },
      [],
    );

    await service.deleteOwnAccount('u1');

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        phone: null,
        email: null,
        deletedPhoneHash: expectedHash('+919999999999'),
        deletedEmailHash: expectedHash('a@example.com'),
      }),
    });
  });

  it('leaves the hash columns null when the account never had a phone/email', async () => {
    const { service, tx } = makeService({ id: 'u1', deletedAt: null, phone: null, email: null }, []);

    await service.deleteOwnAccount('u1');

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ deletedPhoneHash: null, deletedEmailHash: null }),
    });
  });
});
