import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { LocationsService } from '../locations/locations.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { CdnPurgeService } from '../storage/cdn-purge.service';
import { ListingSlotsService } from '../listing-slots/listing-slots.service';
import { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

// computeDHash calls sharp on a real image buffer — stubbed so addPhoto's own logic (cap,
// duplicate check, counter increment) can be unit-tested without a real image.
jest.mock('../uploads/photo-hash', () => ({ computeDHash: jest.fn().mockResolvedValue('deadbeef') }));

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService() {
  const prisma = {
    favourite: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    listing: { update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    listingRenewal: { create: jest.fn() },
    listingEditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const notificationsService = {
    notifyListingLiked: jest.fn(),
  } as unknown as NotificationsService;
  const listingSlotsService = {
    assertCanRenew: jest.fn(),
  } as unknown as ListingSlotsService;

  const service = new ListingsService(
    prisma,
    {} as ModerationService,
    { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
    notificationsService,
    {} as SavedSearchesService,
    {} as LocationsService,
    {} as R2StorageService,
    {} as CdnPurgeService,
    listingSlotsService,
    {} as GoogleAdsConversionProvider,
    {} as ContactRevealService,
  );
  return { service, prisma, notificationsService, listingSlotsService };
}

describe('ListingsService.list — word match + fuzzy title search', () => {
  function makeListService(fuzzyMatchedIds: string[] = []) {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest
      .fn<Promise<number>, [{ where: Prisma.ListingWhereInput }]>()
      .mockResolvedValue(0);
    const queryRaw = jest
      .fn<Promise<{ id: string }[]>, [Prisma.Sql]>()
      .mockResolvedValue(fuzzyMatchedIds.map((id) => ({ id })));
    const prisma = {
      listing: { findMany, count },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    const contactRevealService = {
      getRevealStatesForListings: jest.fn().mockResolvedValue(new Map()),
    } as unknown as ContactRevealService;

    const service = new ListingsService(
      prisma,
      {} as ModerationService,
      { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
      {} as NotificationsService,
      {} as SavedSearchesService,
      {} as LocationsService,
      {} as R2StorageService,
      {} as CdnPurgeService,
      {} as ListingSlotsService,
      {} as GoogleAdsConversionProvider,
      contactRevealService,
    );
    return { service, findMany, count, queryRaw };
  }

  it('resolves title matches via a fuzzy/word-match lookup and filters by the ids it returns', async () => {
    const { service, count, queryRaw } = makeListService([
      'listing1',
      'listing2',
    ]);
    await service.list({ q: 'wooden wardrobe', offset: 0, limit: 20 });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const where = count.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ id: { in: ['listing1', 'listing2'] } }]);
  });

  it('requires every word to independently match — the raw query is built from one condition per word', async () => {
    const { service, queryRaw } = makeListService();
    await service.list({ q: 'wooden wardrobe', offset: 0, limit: 20 });

    // Prisma.sql's bound values, in order — two params per word (the ILIKE pattern and the
    // word_similarity argument), so both "wooden" and "wardrobe" must appear as their own
    // independent condition rather than one combined phrase.
    const sqlArg = queryRaw.mock.calls[0][0];
    expect(sqlArg.values).toEqual([
      '%wooden%',
      'wooden',
      '%wardrobe%',
      'wardrobe',
    ]);
  });

  it('returns zero matches (not everything) when the fuzzy lookup finds nothing', async () => {
    const { service, count } = makeListService([]);
    await service.list({ q: 'nonexistent keyword', offset: 0, limit: 20 });

    const where = count.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ id: { in: [] } }]);
  });

  it('skips the fuzzy lookup entirely and omits the AND clause when there is no query text', async () => {
    const { service, count, queryRaw } = makeListService();
    await service.list({ offset: 0, limit: 20 });

    expect(queryRaw).not.toHaveBeenCalled();
    const where = count.mock.calls[0][0].where;
    expect(where.AND).toBeUndefined();
  });
});

describe('ListingsService.listEngagement', () => {
  function makeEngagementService(opts: {
    favourites?: { user: { id: string; name: string | null; phone: string | null; email: string | null }; createdAt: Date }[];
    views?: { viewerKey: string; createdAt: Date }[];
    users?: { id: string; name: string | null; phone: string | null; email: string | null }[];
    favouriteCount?: number;
    viewCount?: number;
  }) {
    const prisma = {
      favourite: {
        findMany: jest.fn().mockResolvedValue(opts.favourites ?? []),
        count: jest.fn().mockResolvedValue(opts.favouriteCount ?? (opts.favourites ?? []).length),
      },
      listingView: {
        findMany: jest.fn().mockResolvedValue(opts.views ?? []),
        count: jest.fn().mockResolvedValue(opts.viewCount ?? (opts.views ?? []).length),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(opts.users ?? []),
      },
    } as unknown as PrismaService;

    const service = new ListingsService(
      prisma,
      {} as ModerationService,
      { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
      {} as NotificationsService,
      {} as SavedSearchesService,
      {} as LocationsService,
      {} as R2StorageService,
      {} as CdnPurgeService,
      {} as ListingSlotsService,
      {} as GoogleAdsConversionProvider,
      {} as ContactRevealService,
    );
    return { service, prisma };
  }

  const user = (id: string) => ({ id, name: `User ${id}`, phone: null, email: null });

  it('merges liked and viewed rows sorted newest-first', async () => {
    const { service } = makeEngagementService({
      favourites: [{ user: user('u1'), createdAt: past(1) }],
      views: [{ viewerKey: 'user:u2', createdAt: past(0.5) }],
      users: [user('u2')],
    });

    const result = await service.listEngagement('listing1', 0, 25);
    expect(result.items.map((r) => [r.userId, r.action])).toEqual([
      ['u2', 'viewed'],
      ['u1', 'liked'],
    ]);
    expect(result.total).toBe(2);
  });

  it('shows the same user twice if they both liked and viewed', async () => {
    const { service } = makeEngagementService({
      favourites: [{ user: user('u1'), createdAt: past(1) }],
      views: [{ viewerKey: 'user:u1', createdAt: past(0.5) }],
      users: [user('u1')],
    });

    const result = await service.listEngagement('listing1', 0, 25);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((r) => r.action).sort()).toEqual(['liked', 'viewed']);
  });

  it('drops a view row whose viewerKey points at a deleted user', async () => {
    const { service } = makeEngagementService({
      views: [{ viewerKey: 'user:deleted', createdAt: past(0.5) }],
      users: [], // the user lookup found nothing — deleted since the view was recorded
    });

    const result = await service.listEngagement('listing1', 0, 25);
    expect(result.items).toEqual([]);
  });

  it('never includes anonymous views — only user-prefixed viewerKeys are queried', async () => {
    const { service, prisma } = makeEngagementService({});
    await service.listEngagement('listing1', 0, 25);
    expect(prisma.listingView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ viewerKey: { startsWith: 'user:' } }),
      }),
    );
  });
});

describe('ListingsService', () => {
  describe('residential attributes', () => {
    const validAttributes = {
      bedrooms: '2',
      bathrooms: '2',
      carpetAreaSqft: '950',
      balconyCount: '1',
      openParkingCount: '1',
      closedParkingCount: '0',
      gatedCommunity: 'yes',
      priceNegotiable: 'no',
      fromBroker: 'yes',
      brokerageFeeApplicable: 'yes',
      brokerageFee: '10000',
      maintenanceFeeApplicable: 'yes',
      monthlyMaintenanceFee: '2500',
      gasPipeline: 'yes',
      preferredTenantTypes: ['family', 'company'],
    };

    it('accepts valid rent attributes and multi-select tenant types', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes(
          'apartment',
          'rent',
          validAttributes,
        ),
      ).not.toThrow();
    });

    it('rejects a fee amount when the fee is not applicable', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'buy', {
          bedrooms: '2',
          bathrooms: '2',
          carpetAreaSqft: '950',
          maintenanceFeeApplicable: 'no',
          monthlyMaintenanceFee: '2500',
        }),
      ).toThrow(
        'Monthly maintenance fee amount requires applicability to be Yes',
      );
    });

    it('accepts legacy sqft as the area required by older listings', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'sell', {
          bedrooms: 2,
          bathrooms: 2,
          sqft: 950,
        }),
      ).not.toThrow();
    });

    it('rejects furnishing inventory when the residence is not furnished', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'rent', {
          bedrooms: 2,
          bathrooms: 2,
          carpetAreaSqft: 950,
          furnished: 'semi',
          sofaCount: 1,
        }),
      ).toThrow('Sofas is not applicable');
    });

    it('accepts all configured amenities and furnishing inventory for a furnished home', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'buy', {
          bedrooms: 3,
          bathrooms: 2,
          carpetAreaSqft: 1450,
          furnished: 'furnished',
          washingMachineCount: 1,
          sofaCount: 1,
          stoveCount: 1,
          fridgeCount: 1,
          cupboardCount: 3,
          fanCount: 5,
          lightCount: 8,
          bedCount: 3,
          tvCount: 2,
          geyserCount: 2,
          tableCount: 2,
          diningTableCount: 1,
          cctv: 'yes',
          lift: 'yes',
          powerBackup: 'no',
          waterSupply: 'yes',
          playArea: 'yes',
          gym: 'no',
          swimmingPool: 'no',
          clubHouse: 'yes',
        }),
      ).not.toThrow();
    });

    it('rejects invalid amenity values and negative inventory counts', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('apartment', 'rent', {
          bedrooms: 2,
          bathrooms: 2,
          carpetAreaSqft: 950,
          furnished: 'furnished',
          cctv: 'sometimes',
        }),
      ).toThrow('Invalid cctv');

      expect(() =>
        (service as any).assertValidAttributes('apartment', 'rent', {
          bedrooms: 2,
          bathrooms: 2,
          carpetAreaSqft: 950,
          furnished: 'furnished',
          fanCount: -1,
        }),
      ).toThrow('Fans must be a whole number');
    });

    it('rejects rent-only fields on a buy listing', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('villa', 'buy', {
          bedrooms: 3,
          bathrooms: 2,
          carpetAreaSqft: 1800,
          preferredTenantTypes: ['family'],
        }),
      ).toThrow('Preferred tenant type is not applicable');
    });
  });

  describe('acceptVideosForOwner — video entitlement by agentPro/boost', () => {
    // v2 (90s) exceeds the default 30s cap but fits the elevated 120s cap — this array is sized
    // to exactly the elevated maxVideos (3), so "all accepted" is a meaningful assertion below.
    const videos = [
      { durationSec: 20, storageId: 'a', ext: 'mp4', sizeBytes: 1 },
      { durationSec: 90, storageId: 'b', ext: 'mp4', sizeBytes: 1 },
      { durationSec: 25, storageId: 'c', ext: 'mp4', sizeBytes: 1 },
    ];

    async function accept(agentProUntil: Date | null, ownerId = 'owner1') {
      const { service, prisma } = makeService();
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        agentProUntil,
      });
      // acceptVideosForOwner is private — accessed via bracket notation, the standard escape
      // hatch for unit-testing a private helper without changing its visibility for production code.
      return (service as any).acceptVideosForOwner(ownerId, videos);
    }

    it('a free user is trimmed to the default (lower) video allowance', async () => {
      const result = await accept(null);
      expect(result.length).toBeLessThan(videos.length);
    });

    it('an active agentPro owner keeps the elevated allowance (all videos accepted)', async () => {
      const result = await accept(future());
      expect(result).toHaveLength(videos.length);
    });

    it('an expired agentPro owner is treated as free-tier', async () => {
      const freeResult = await accept(null);
      const expiredResult = await accept(past());
      expect(expiredResult).toEqual(freeResult);
    });

    it('an empty videos array short-circuits without touching Prisma', async () => {
      const { service, prisma } = makeService();
      const result = await (service as any).acceptVideosForOwner('owner1', []);
      expect(result).toEqual([]);
      expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('addVideo — rejection messages branch on boost-upgrade eligibility', () => {
    function setup(
      owner: { agentProUntil: Date | null },
      listing: Record<string, unknown>,
    ) {
      const { service, prisma } = makeService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(listing);
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(owner);
      return { service, prisma };
    }

    it('a free, unboosted owner at the default video cap is told to boost to upgrade', async () => {
      const { service } = setup(
        { agentProUntil: null },
        {
          ownerId: 'owner1',
          boostedUntil: null,
          listingVideos: [{ videoNo: 1 }],
        },
      );
      const call = service.addVideo('listing1', 'owner1', {
        durationSec: 10,
        storageId: 'x',
        ext: 'mp4',
        sizeBytes: 1,
      });
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('Boost this listing');
    });

    it('an agentPro owner at the elevated cap gets the flat "maximum" message (no further upgrade)', async () => {
      const { service } = setup(
        { agentProUntil: future() },
        {
          ownerId: 'owner1',
          boostedUntil: null,
          listingVideos: [{ videoNo: 1 }, { videoNo: 2 }, { videoNo: 3 }],
        },
      );
      const call = service.addVideo('listing1', 'owner1', {
        durationSec: 10,
        storageId: 'x',
        ext: 'mp4',
        sizeBytes: 1,
      });
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('maximum');
    });

    it('rejects a video longer than the entitlement duration', async () => {
      const { service } = setup(
        { agentProUntil: null },
        { ownerId: 'owner1', boostedUntil: null, listingVideos: [] },
      );
      const call = service.addVideo('listing1', 'owner1', {
        durationSec: 999,
        storageId: 'x',
        ext: 'mp4',
        sizeBytes: 1,
      });
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('30s limit');
    });

    it("throws NotFoundException-equivalent when the caller doesn't own the listing", async () => {
      const { service } = setup(
        { agentProUntil: null },
        { ownerId: 'someoneElse', boostedUntil: null, listingVideos: [] },
      );
      await expect(
        service.addVideo('listing1', 'owner1', {
          durationSec: 10,
          storageId: 'x',
          ext: 'mp4',
          sizeBytes: 1,
        }),
      ).rejects.toThrow("You don't own this listing");
    });
  });

  describe('addPhoto / deletePhoto', () => {
    const file = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' } as Express.Multer.File;

    function makePhotoService(opts: {
      listingPhotos?: { photoNo: number }[];
      ownerId?: string;
      isDuplicate?: boolean;
    } = {}) {
      let counter = opts.listingPhotos?.length ?? 0;
      const prisma = {
        listing: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'listing1',
            ownerId: opts.ownerId ?? 'owner1',
            listingPhotos: opts.listingPhotos ?? [],
          }),
          // Mirrors the real atomic { increment: 1 } — a fresh, strictly-higher value every call,
          // never reused, which is exactly the property the "never collide" test below checks.
          update: jest.fn().mockImplementation(() => Promise.resolve({ photoNoCounter: ++counter })),
        },
        listingPhoto: {
          findUnique: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        },
        photoVariantJob: {
          findMany: jest.fn().mockResolvedValue([{ ext: 'jpg' }]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        $transaction: jest.fn().mockResolvedValue([]),
      } as unknown as PrismaService;

      const moderationService = {
        isDuplicatePhotoHash: jest.fn().mockResolvedValue(opts.isDuplicate ?? false),
      } as unknown as ModerationService;
      const storage = {
        putObject: jest.fn().mockResolvedValue(undefined),
        deleteObject: jest.fn().mockResolvedValue(undefined),
      } as unknown as R2StorageService;
      const cdnPurge = { purgeUrls: jest.fn().mockResolvedValue(true) } as unknown as CdnPurgeService;

      const service = new ListingsService(
        prisma,
        moderationService,
        { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
        {} as NotificationsService,
        {} as SavedSearchesService,
        {} as LocationsService,
        storage,
        cdnPurge,
        {} as ListingSlotsService,
        {} as GoogleAdsConversionProvider,
        {} as ContactRevealService,
      );
      // getMine's own plumbing (toDetailDto etc.) isn't what these tests are about — stubbed so
      // a resolved add/delete just needs to not throw, not exercise the whole DTO pipeline.
      jest.spyOn(service, 'getMine').mockResolvedValue({} as any);

      return { service, prisma, moderationService, storage, cdnPurge };
    }

    it("rejects when the caller doesn't own the listing", async () => {
      const { service } = makePhotoService({ ownerId: 'someoneElse' });
      await expect(service.addPhoto('listing1', 'owner1', file)).rejects.toThrow(
        "You don't own this listing",
      );
    });

    it('rejects at MAX_PHOTOS without incrementing the counter', async () => {
      const { service, prisma } = makePhotoService({
        listingPhotos: [1, 2, 3, 4, 5, 6].map((photoNo) => ({ photoNo })),
      });
      await expect(service.addPhoto('listing1', 'owner1', file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('rejects a duplicate photo hash without incrementing the counter', async () => {
      const { service, prisma } = makePhotoService({ isDuplicate: true });
      await expect(service.addPhoto('listing1', 'owner1', file)).rejects.toThrow(
        'already be in use',
      );
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('two sequential adds never produce the same photoNo', async () => {
      const { service, prisma } = makePhotoService({ listingPhotos: [{ photoNo: 1 }] });
      await service.addPhoto('listing1', 'owner1', file);
      await service.addPhoto('listing1', 'owner1', file);
      const photoNos = (prisma.listingPhoto.create as jest.Mock).mock.calls.map(
        (call) => call[0].data.photoNo,
      );
      expect(new Set(photoNos).size).toBe(photoNos.length);
      expect(photoNos.every((n) => n > 1)).toBe(true); // never reissues an already-used number
    });

    it("deletePhoto rejects when the caller doesn't own the listing", async () => {
      const { service, prisma } = makePhotoService({ ownerId: 'someoneElse' });
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ ownerId: 'someoneElse' });
      await expect(service.deletePhoto('listing1', 'owner1', 1)).rejects.toThrow(
        "You don't own this listing",
      );
    });

    it('deletePhoto 404s on a photoNo that was never on this listing', async () => {
      const { service, prisma } = makePhotoService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ ownerId: 'owner1' });
      (prisma.listingPhoto.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.deletePhoto('listing1', 'owner1', 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletePhoto reads PhotoVariantJob.ext before deleting, to reconstruct the original R2 key', async () => {
      const { service, prisma, storage } = makePhotoService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ ownerId: 'owner1' });
      (prisma.listingPhoto.findUnique as jest.Mock).mockResolvedValue({ photoNo: 1 });
      await service.deletePhoto('listing1', 'owner1', 1);
      expect(prisma.photoVariantJob.findMany).toHaveBeenCalled();
      // preview + full + original(jpg) = 3 keys fire-and-forget deleted
      expect((storage.deleteObject as jest.Mock).mock.calls.length).toBe(3);
    });
  });

  describe('renew — expiry bump + audit trail', () => {
    const DAY_MS = 24 * HOUR_MS;

    function listingRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'listing1',
        ownerId: 'owner1',
        status: 'active',
        category: 'apartment',
        transactionType: 'buy',
        slug: 'an-apartment',
        tag: 'Apartment',
        price: 1000,
        priceQualifier: '',
        title: 'An apartment',
        specs: [],
        attributes: {},
        moderationState: 'approved',
        adminReviewed: false,
        moderatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: future(24),
        viewCount: 0,
        likeCount: 0,
        boostedUntil: null,
        lat: null,
        lng: null,
        city: { name: 'Pune' },
        area: { name: 'Baner', lat: null, lng: null },
        listingPhotos: [],
        listingVideos: [],
        listingRenewals: [],
        owner: { agentProUntil: null },
        ...overrides,
      };
    }

    function setup(existing: Record<string, unknown>, updated = listingRow()) {
      const ctx = makeService();
      (ctx.prisma.listing.findUnique as jest.Mock).mockResolvedValue(existing);
      (ctx.prisma.$transaction as jest.Mock).mockResolvedValue([{}, updated]);
      return ctx;
    }

    it('stacks 30 days onto the remaining time when renewed before expiry', async () => {
      const expiresAt = future(24);
      const { service, prisma } = setup(listingRow({ expiresAt }));

      await service.renew('listing1', 'owner1');

      const renewalArgs = (prisma.listingRenewal.create as jest.Mock).mock
        .calls[0][0];
      expect(renewalArgs.data.previousExpiresAt).toEqual(expiresAt);
      expect(renewalArgs.data.newExpiresAt.getTime()).toBe(
        expiresAt.getTime() + 30 * DAY_MS,
      );
    });

    it('counts from today (not the lapsed date) when renewed after expiry', async () => {
      const before = Date.now();
      const { service, prisma } = setup(listingRow({ expiresAt: past(72) }));

      await service.renew('listing1', 'owner1');

      const { newExpiresAt } = (prisma.listingRenewal.create as jest.Mock).mock
        .calls[0][0].data;
      expect(newExpiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 30 * DAY_MS,
      );
    });

    it('writes the audit row and the expiry bump in a single transaction', async () => {
      const { service, prisma } = setup(listingRow());

      await service.renew('listing1', 'owner1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect((prisma.$transaction as jest.Mock).mock.calls[0][0]).toHaveLength(
        2,
      );
    });

    it('reports the renewal count and history back to the owner', async () => {
      const renewedAt = past(1);
      const { service } = setup(
        listingRow(),
        listingRow({
          listingRenewals: [
            { previousExpiresAt: past(2), newExpiresAt: future(48), renewedAt },
          ],
        }),
      );

      const dto = await service.renew('listing1', 'owner1');

      expect(dto.renewCount).toBe(1);
      expect(dto.renewalHistory?.[0].renewedAt).toBe(renewedAt.toISOString());
    });

    it('rejects a non-active listing', async () => {
      const { service } = setup(listingRow({ status: 'sold' }));
      await expect(service.renew('listing1', 'owner1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects a caller who doesn't own the listing", async () => {
      const { service } = setup(listingRow({ ownerId: 'someoneElse' }));
      await expect(service.renew('listing1', 'owner1')).rejects.toThrow(
        "You don't own this listing",
      );
    });

    it('propagates the slot-cap rejection and writes nothing', async () => {
      const { service, prisma, listingSlotsService } = setup(listingRow());
      (listingSlotsService.assertCanRenew as jest.Mock).mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(service.renew('listing1', 'owner1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavourite — like-notification is boost-gated', () => {
    it('notifies the owner when the listing is currently boosted and the liker is someone else', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 5,
        title: 'A boosted listing',
        ownerId: 'owner1',
        boostedUntil: future(),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'owner@example.com',
        phone: null,
      });

      await service.toggleFavourite('listing1', 'liker1');
      // fire-and-forget: allow the notify microtask to settle
      await new Promise((r) => setImmediate(r));

      expect(notificationsService.notifyListingLiked).toHaveBeenCalled();
    });

    it('does not notify when the listing is not currently boosted', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 2,
        title: 'An unboosted listing',
        ownerId: 'owner1',
        boostedUntil: null,
      });

      await service.toggleFavourite('listing1', 'liker1');
      await new Promise((r) => setImmediate(r));

      expect(notificationsService.notifyListingLiked).not.toHaveBeenCalled();
    });

    it('does not notify when the owner likes their own boosted listing', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 5,
        title: 'Own boosted listing',
        ownerId: 'owner1',
        boostedUntil: future(),
      });

      await service.toggleFavourite('listing1', 'owner1');
      await new Promise((r) => setImmediate(r));

      expect(notificationsService.notifyListingLiked).not.toHaveBeenCalled();
    });
  });
});

describe('ListingsService.listForAdmin — status filter and sort', () => {
  // findMany resolving to [] means toDetailDto (which needs a fully-shaped row: city, area,
  // owner, media, etc.) is never actually called — this only needs to inspect what where/orderBy
  // the method builds, not exercise the DTO mapping.
  async function callWith(query: Record<string, unknown>) {
    const { service, prisma } = makeService();
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.listing.count as jest.Mock).mockResolvedValue(0);
    await service.listForAdmin({ limit: 25, ...query } as never);
    return {
      where: (prisma.listing.findMany as jest.Mock).mock.calls[0][0].where,
      orderBy: (prisma.listing.findMany as jest.Mock).mock.calls[0][0].orderBy,
    };
  }

  it('filters by status when given', async () => {
    const { where } = await callWith({ status: 'deactivated' });
    expect(where).toMatchObject({ status: 'deactivated' });
  });

  it('omits status from the where clause when not given', async () => {
    const { where } = await callWith({});
    expect(where).not.toHaveProperty('status');
  });

  it('sorts by status ascending and descending', async () => {
    expect((await callWith({ sort: 'status_asc' })).orderBy).toEqual([{ status: 'asc' }, { id: 'asc' }]);
    expect((await callWith({ sort: 'status_desc' })).orderBy).toEqual([{ status: 'desc' }, { id: 'asc' }]);
  });

  it('still defaults to newest-created when no sort is given', async () => {
    expect((await callWith({})).orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });
});

describe('ListingsService.update — writes a ListingEditLog diff', () => {
  it('logs only the fields that actually changed, with their before/after values', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({
      id: 'l1',
      ownerId: 'owner1',
      category: 'pg',
      transactionType: 'rent',
      price: 5000,
      priceQualifier: '/month',
      title: 'Old title',
      specs: ['Single'],
      description: 'Old description',
      attributes: { sharingType: 'single' },
      status: 'active',
      moderationState: 'approved',
    });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});
    // toDetailDto isn't relevant to this test — let it throw on the incomplete mock row above
    // rather than fully mocking city/area/media/owner just to reach a return value we don't check.
    await service.update('l1', 'owner1', { price: 6000 } as never).catch(() => undefined);

    expect(prisma.listingEditLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'l1',
        actorType: 'owner',
        actorId: 'owner1',
        action: 'updated',
        changes: { price: { before: 5000, after: 6000 } },
      },
    });
  });

  it('does not write a log row when nothing in the dto actually changed the value', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({
      id: 'l1',
      ownerId: 'owner1',
      category: 'pg',
      transactionType: 'rent',
      price: 5000,
      priceQualifier: '/month',
      title: 'Same title',
      specs: [],
      description: null,
      attributes: {},
      status: 'active',
      moderationState: 'approved',
    });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});

    await service.update('l1', 'owner1', { price: 5000, title: 'Same title' } as never).catch(() => undefined);

    expect(prisma.listingEditLog.create).not.toHaveBeenCalled();
  });
});

describe('ListingsService.flag/approve/setStatusAsAdmin — attribute the change to the admin', () => {
  it('flag() logs the moderationState before/after and the admin as actor', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ moderationState: 'approved' });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});

    await service.flag('l1', 'admin1').catch(() => undefined);

    expect(prisma.listingEditLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'l1',
        actorType: 'admin',
        actorId: 'admin1',
        action: 'flagged',
        changes: { moderationState: { before: 'approved', after: 'flagged' } },
      },
    });
  });

  it('approve() logs the moderationState before/after and the admin as actor', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ moderationState: 'flagged' });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});

    await service.approve('l1', 'admin1').catch(() => undefined);

    expect(prisma.listingEditLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'l1',
        actorType: 'admin',
        actorId: 'admin1',
        action: 'approved',
        changes: { moderationState: { before: 'flagged', after: 'approved' } },
      },
    });
  });

  it('setStatusAsAdmin() logs the status change when it actually changes', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ status: 'active' });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});

    await service.setStatusAsAdmin('l1', 'deactivated', 'admin1').catch(() => undefined);

    expect(prisma.listingEditLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'l1',
        actorType: 'admin',
        actorId: 'admin1',
        action: 'status_changed',
        changes: { status: { before: 'active', after: 'deactivated' } },
      },
    });
  });

  it('setStatusAsAdmin() does not log when the status is unchanged', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ status: 'active' });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});

    await service.setStatusAsAdmin('l1', 'active', 'admin1').catch(() => undefined);

    expect(prisma.listingEditLog.create).not.toHaveBeenCalled();
  });
});

describe('ListingsService.claimListing — re-clicking an already-claimed link', () => {
  it('the same owner clicking the link again is a silent no-op success, not an error', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({
      id: 'l1',
      ownerId: 'owner1',
      claimContactId: 'contact1',
      claimContact: { phoneE164: '+919876543210' },
      claimedAt: new Date(),
    });

    // toDetailDto isn't relevant here — this only checks that the already-claiming-user path
    // never reaches the claim transaction at all, not what getMine() ultimately returns.
    await service.claimListing('l1', 'owner1').catch(() => undefined);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a different account hitting an already-claimed listing gets a clear conflict, not a generic error', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({
      id: 'l1',
      ownerId: 'owner1',
      claimContactId: 'contact1',
      claimContact: { phoneE164: '+919876543210' },
      claimedAt: new Date(),
    });

    await expect(service.claimListing('l1', 'someone-else')).rejects.toThrow(ConflictException);
    await expect(service.claimListing('l1', 'someone-else')).rejects.toThrow(/already been claimed by someone else/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
