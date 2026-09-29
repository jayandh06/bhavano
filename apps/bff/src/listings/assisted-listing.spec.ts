import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingsService } from './listings.service';
import {
  ASSISTED_CLAIM_DAYS,
  assistedClaimCutoff,
  assistedClaimUrl,
  maskClaimPhone,
} from './assisted-listing';
import type { PrismaService } from '../prisma/prisma.service';
import type { ListingSlotsService } from '../listing-slots/listing-slots.service';
import type { PlatformFeeSettingsService } from '../plans/platform-fee-settings.service';

describe('assisted listing helpers', () => {
  it('masks the claim phone to its first two and last three digits', () => {
    expect(maskClaimPhone('+919876543210')).toBe('+91 98xxx xx210');
    expect(maskClaimPhone(null)).toBeNull();
    expect(maskClaimPhone('+9112')).toBeNull();
  });

  it('builds the assisted claim link without a doubled slash', () => {
    expect(assistedClaimUrl('https://www.bhavano.com/', 'abc')).toBe(
      'https://www.bhavano.com/claim/abc?via=assisted',
    );
  });

  it('cuts off ASSISTED_CLAIM_DAYS before now', () => {
    const now = new Date('2026-10-15T00:00:00Z');
    expect(now.getTime() - assistedClaimCutoff(now).getTime()).toBe(
      ASSISTED_CLAIM_DAYS * 24 * 60 * 60 * 1000,
    );
  });
});

type Mocked = {
  listing: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  listingEditLog: { create: jest.Mock };
};

function makeService(opts: { platformFee?: number } = {}) {
  const prisma: Mocked = {
    listing: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'l1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn(),
    },
    user: { findUnique: jest.fn(), update: jest.fn() },
    listingEditLog: { create: jest.fn() },
  };
  const listingSlotsService = {
    assertCanPublish: jest.fn().mockResolvedValue(undefined),
  };
  const platformFee = opts.platformFee ?? 0;
  const service = new ListingsService(
    prisma as unknown as PrismaService,
    {} as never,
    { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    listingSlotsService as unknown as ListingSlotsService,
    {} as never,
    {} as never,
    {
      getSettings: jest.fn().mockResolvedValue({
        propertyListingFee: platformFee,
        coworkingPgStorageListingFee: platformFee,
        furnitureInteriorsListingFee: platformFee,
        allowLivePublishWithPendingPayment: false,
      }),
    } as unknown as PlatformFeeSettingsService,
    {} as never,
    {} as never,
  );
  const internals = service as unknown as {
    toDetailDto: jest.Mock;
    runPostLiveSideEffects: jest.Mock;
  };
  internals.toDetailDto = jest.fn().mockReturnValue({ id: 'l1' });
  internals.runPostLiveSideEffects = jest.fn().mockResolvedValue(undefined);
  return { service, prisma, listingSlotsService, internals };
}

const assistedListing = {
  id: 'l1',
  ownerId: 'bulk',
  category: 'apartment',
  claimContactId: null,
  claimContact: null,
  claimPhoneE164: '+919876543210',
  claimSellerType: 'owner',
  claimedAt: null,
  publishState: 'awaiting_claim',
};

describe('ListingsService.claimListing — admin-assisted listings', () => {
  it('rejects a sign-in with a different phone, pointing the seller at the number they gave', async () => {
    const { service, prisma } = makeService();
    prisma.listing.findUnique.mockResolvedValue(assistedListing);
    prisma.user.findUnique.mockResolvedValue({ phone: '9123456789' });

    await expect(service.claimListing('l1', 'u1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.claimListing('l1', 'u1')).rejects.toThrow(
      /number you gave us/,
    );
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });

  it('publishes to the seller, saves their Owner/Agent answer, and runs the live side effects', async () => {
    const { service, prisma, listingSlotsService, internals } = makeService();
    prisma.listing.findUnique.mockResolvedValue(assistedListing);
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '9876543210' })
      .mockResolvedValueOnce({
        deletedAt: null,
        phone: '9876543210',
        email: null,
        acquisitionGclid: null,
        sellerType: null,
      });

    await service.claimListing('l1', 'u1');

    expect(listingSlotsService.assertCanPublish).toHaveBeenCalledWith('u1');
    const [{ where, data }] = prisma.listing.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(where).toEqual({
      id: 'l1',
      claimedAt: null,
      publishState: 'awaiting_claim',
    });
    expect(data.ownerId).toBe('u1');
    expect(data.publishState).toBe('live');
    expect(data.claimSource).toBe('assisted');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { sellerType: 'owner' },
    });
    // No ad click on file, so no conversion is credited for an ad staff typed.
    const [sideEffectArgs] = internals.runPostLiveSideEffects.mock
      .calls as unknown[][];
    expect(sideEffectArgs[2]).toBe(false);
  });

  it("keeps a seller's existing Owner/Agent answer", async () => {
    const { service, prisma } = makeService();
    prisma.listing.findUnique.mockResolvedValue(assistedListing);
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '9876543210' })
      .mockResolvedValueOnce({
        deletedAt: null,
        phone: '9876543210',
        acquisitionGclid: 'g',
        sellerType: 'agent',
      });

    await service.claimListing('l1', 'u1');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('holds the ad for the platform fee like the seller posting it themselves', async () => {
    const { service, prisma, internals } = makeService({ platformFee: 99 });
    prisma.listing.findUnique.mockResolvedValue(assistedListing);
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '9876543210' })
      .mockResolvedValueOnce({
        deletedAt: null,
        phone: '9876543210',
        sellerType: 'owner',
      });

    await service.claimListing('l1', 'u1');

    const [{ data }] = prisma.listing.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.publishState).toBe('pending_checkout');
    expect(internals.runPostLiveSideEffects).not.toHaveBeenCalled();
  });

  it('checks the seller listing limit before taking the listing', async () => {
    const { service, prisma, listingSlotsService } = makeService();
    prisma.listing.findUnique.mockResolvedValue(assistedListing);
    prisma.user.findUnique.mockResolvedValue({ phone: '9876543210' });
    listingSlotsService.assertCanPublish.mockRejectedValue(
      new ForbiddenException('cap'),
    );

    await expect(service.claimListing('l1', 'u1')).rejects.toThrow('cap');
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });

  it('loses cleanly to a concurrent claim', async () => {
    const { service, prisma } = makeService();
    prisma.listing.findUnique.mockResolvedValue(assistedListing);
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '9876543210' })
      .mockResolvedValueOnce({
        deletedAt: null,
        phone: '9876543210',
        sellerType: null,
      });
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.claimListing('l1', 'u1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('ListingsService.createAssisted', () => {
  it('rejects a phone that is not an Indian mobile', async () => {
    const { service } = makeService();
    await expect(
      service.createAssisted(
        { claimPhone: '12345', claimName: 'Ravi', postedAs: 'owner' } as never,
        'admin1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates under the Bulk Import account with the seller details kept for the claim', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'bulk' });
    const create = jest
      .spyOn(service, 'create')
      .mockResolvedValue({ id: 'l1' } as never);

    await service.createAssisted(
      {
        id: 'l1',
        claimPhone: '+91 98765 43210',
        claimName: ' Ravi ',
        postedAs: 'agent',
        photos: [],
      } as never,
      'admin1',
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'l1', postedAs: undefined }),
      'bulk',
      false,
      {
        claimPhoneE164: '+919876543210',
        claimName: 'Ravi',
        claimSellerType: 'agent',
        adminId: 'admin1',
      },
    );
  });
});

describe('ListingsService.getClaimPreview', () => {
  it('404s for a listing nobody can claim', async () => {
    const { service, prisma } = makeService();
    prisma.listing.findUnique.mockResolvedValue({
      ...assistedListing,
      claimPhoneE164: null,
      listingPhotos: [],
    });
    await expect(service.getClaimPreview('l1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListingsService.deleteExpiredAssistedListings', () => {
  it('deletes only unclaimed assisted listings past the claim window', async () => {
    const { service, prisma } = makeService();
    prisma.listing.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const deleteCompletely = jest
      .spyOn(service, 'deleteCompletely')
      .mockResolvedValue(undefined);
    const now = new Date('2026-10-15T00:00:00Z');

    await expect(service.deleteExpiredAssistedListings(now)).resolves.toBe(2);

    expect(prisma.listing.findMany).toHaveBeenCalledWith({
      where: {
        publishState: 'awaiting_claim',
        claimedAt: null,
        createdAt: { lt: assistedClaimCutoff(now) },
      },
      select: { id: true },
    });
    expect(deleteCompletely.mock.calls).toEqual([['a'], ['b']]);
  });
});
