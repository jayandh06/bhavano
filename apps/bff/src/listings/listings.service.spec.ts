import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { LocationsService } from '../locations/locations.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { ListingSlotsService } from '../listing-slots/listing-slots.service';
import { ConfigService } from '@nestjs/config';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService() {
  const prisma = {
    favourite: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    listing: { update: jest.fn(), findUnique: jest.fn() },
    listingRenewal: { create: jest.fn() },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const notificationsService = { notifyListingLiked: jest.fn() } as unknown as NotificationsService;
  const listingSlotsService = { assertCanRenew: jest.fn() } as unknown as ListingSlotsService;

  const service = new ListingsService(
    prisma,
    {} as ModerationService,
    { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
    notificationsService,
    {} as SavedSearchesService,
    {} as LocationsService,
    {} as R2StorageService,
    listingSlotsService,
  );
  return { service, prisma, notificationsService, listingSlotsService };
}

describe('ListingsService', () => {
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
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ agentProUntil });
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
    function setup(owner: { agentProUntil: Date | null }, listing: Record<string, unknown>) {
      const { service, prisma } = makeService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(listing);
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(owner);
      return { service, prisma };
    }

    it('a free, unboosted owner at the default video cap is told to boost to upgrade', async () => {
      const { service } = setup(
        { agentProUntil: null },
        { ownerId: 'owner1', boostedUntil: null, listingVideos: [{ videoNo: 1 }] },
      );
      const call = service.addVideo('listing1', 'owner1', { durationSec: 10, storageId: 'x', ext: 'mp4', sizeBytes: 1 });
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
      const call = service.addVideo('listing1', 'owner1', { durationSec: 10, storageId: 'x', ext: 'mp4', sizeBytes: 1 });
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('maximum');
    });

    it('rejects a video longer than the entitlement duration', async () => {
      const { service } = setup({ agentProUntil: null }, { ownerId: 'owner1', boostedUntil: null, listingVideos: [] });
      const call = service.addVideo('listing1', 'owner1', { durationSec: 999, storageId: 'x', ext: 'mp4', sizeBytes: 1 });
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('30s limit');
    });

    it("throws NotFoundException-equivalent when the caller doesn't own the listing", async () => {
      const { service } = setup({ agentProUntil: null }, { ownerId: 'someoneElse', boostedUntil: null, listingVideos: [] });
      await expect(
        service.addVideo('listing1', 'owner1', { durationSec: 10, storageId: 'x', ext: 'mp4', sizeBytes: 1 }),
      ).rejects.toThrow("You don't own this listing");
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

      const renewalArgs = (prisma.listingRenewal.create as jest.Mock).mock.calls[0][0];
      expect(renewalArgs.data.previousExpiresAt).toEqual(expiresAt);
      expect(renewalArgs.data.newExpiresAt.getTime()).toBe(expiresAt.getTime() + 30 * DAY_MS);
    });

    it('counts from today (not the lapsed date) when renewed after expiry', async () => {
      const before = Date.now();
      const { service, prisma } = setup(listingRow({ expiresAt: past(72) }));

      await service.renew('listing1', 'owner1');

      const { newExpiresAt } = (prisma.listingRenewal.create as jest.Mock).mock.calls[0][0].data;
      expect(newExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
    });

    it('writes the audit row and the expiry bump in a single transaction', async () => {
      const { service, prisma } = setup(listingRow());

      await service.renew('listing1', 'owner1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect((prisma.$transaction as jest.Mock).mock.calls[0][0]).toHaveLength(2);
    });

    it('reports the renewal count and history back to the owner', async () => {
      const renewedAt = past(1);
      const { service } = setup(
        listingRow(),
        listingRow({
          listingRenewals: [{ previousExpiresAt: past(2), newExpiresAt: future(48), renewedAt }],
        }),
      );

      const dto = await service.renew('listing1', 'owner1');

      expect(dto.renewCount).toBe(1);
      expect(dto.renewalHistory?.[0].renewedAt).toBe(renewedAt.toISOString());
    });

    it('rejects a non-active listing', async () => {
      const { service } = setup(listingRow({ status: 'sold' }));
      await expect(service.renew('listing1', 'owner1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a caller who doesn't own the listing", async () => {
      const { service } = setup(listingRow({ ownerId: 'someoneElse' }));
      await expect(service.renew('listing1', 'owner1')).rejects.toThrow("You don't own this listing");
    });

    it('propagates the slot-cap rejection and writes nothing', async () => {
      const { service, prisma, listingSlotsService } = setup(listingRow());
      (listingSlotsService.assertCanRenew as jest.Mock).mockRejectedValue(new ForbiddenException());

      await expect(service.renew('listing1', 'owner1')).rejects.toBeInstanceOf(ForbiddenException);
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
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'owner@example.com', phone: null });

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
