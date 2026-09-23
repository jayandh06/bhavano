import { ForbiddenException } from '@nestjs/common';
import { SavedSearchesService } from './saved-searches.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from '../locations/locations.service';
import type { Area, City, Listing } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService(options: { freeUsed?: number; freeAlertsPerUser?: number } = {}) {
  const prisma = {
    user: { findUnique: jest.fn() },
    savedSearch: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      // How many of this user's alerts already came out of the free quota — the same
      // count-the-rows approach ContactRevealService uses for free reveals.
      count: jest.fn().mockResolvedValue(options.freeUsed ?? 0),
    },
    savedSearchSetting: {
      findUnique: jest.fn().mockResolvedValue({ freeAlertsPerUser: options.freeAlertsPerUser ?? 2 }),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  } as unknown as PrismaService;
  const notificationsService = { notifySavedSearchMatch: jest.fn() } as unknown as NotificationsService;
  const locationsService = {} as LocationsService;

  const service = new SavedSearchesService(prisma, notificationsService, locationsService);
  return { service, prisma, notificationsService };
}

describe('SavedSearchesService', () => {
  /** Alerts were Plus-only on both create and match, and there had never been a single Plus
   * subscriber — so a built feature had zero rows, and the empty-result prompt could not honestly
   * promise anything. A small admin-tunable free quota (SavedSearchSetting.freeAlertsPerUser)
   * fixes that without giving the feature away; these pin both halves of it. */
  describe('create — free quota, then Bhavano Plus', () => {
    it('allows a never-subscribed user while they have free allowance, marked source: free', async () => {
      const { service, prisma } = makeService({ freeUsed: 0 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      (prisma.savedSearch.create as jest.Mock).mockResolvedValue({
        id: 's1', name: 'x', category: null, transactionType: null, cityId: null, city: null,
        areaId: null, area: null, minPrice: null, maxPrice: null, bedrooms: null, createdAt: new Date(),
      });

      await service.create('u1', { name: 'x' } as any);

      const args = (prisma.savedSearch.create as jest.Mock).mock.calls[0][0];
      expect(args.data.source).toBe('free');
    });

    it('rejects a never-subscribed user once the free quota is spent', async () => {
      const { service, prisma } = makeService({ freeUsed: 2, freeAlertsPerUser: 2 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      await expect(service.create('u1', { name: 'x' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a lapsed subscriber who has also spent their free quota', async () => {
      const { service, prisma } = makeService({ freeUsed: 2 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: past() });
      await expect(service.create('u1', { name: 'x' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('honours a freeAlertsPerUser of 0 — the quota is a real switch', async () => {
      const { service, prisma } = makeService({ freeUsed: 0, freeAlertsPerUser: 0 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      await expect(service.create('u1', { name: 'x' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('marks a Plus subscriber source: plus even with free allowance left', async () => {
      const { service, prisma } = makeService({ freeUsed: 0 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: future() });
      (prisma.savedSearch.create as jest.Mock).mockResolvedValue({
        id: 's1', name: 'x', category: null, transactionType: null, cityId: null, city: null,
        areaId: null, area: null, minPrice: null, maxPrice: null, bedrooms: null, createdAt: new Date(),
      });

      await service.create('u1', { name: 'x' } as any);

      // Their free allowance stays untouched for after a lapse.
      expect((prisma.savedSearch.create as jest.Mock).mock.calls[0][0].data.source).toBe('plus');
    });

    it('reports allowance without creating anything', async () => {
      const { service, prisma } = makeService({ freeUsed: 1, freeAlertsPerUser: 2 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });

      expect(await service.alertAllowance('u1')).toEqual({ source: 'free', freeRemaining: 1 });
      expect(prisma.savedSearch.create).not.toHaveBeenCalled();
    });
  });

  describe('create — Bhavano Plus (premiumUntil) gating', () => {
    it('allows an active Bhavano Plus subscriber to create a saved search', async () => {
      const { service, prisma } = makeService();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: future() });
      (prisma.savedSearch.create as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'My search',
        category: null,
        transactionType: null,
        cityId: null,
        city: null,
        areaId: null,
        area: null,
        minPrice: null,
        maxPrice: null,
        bedrooms: null,
        createdAt: new Date(),
      });
      const result = await service.create('u1', { name: 'My search' } as any);
      expect(result.id).toBe('s1');
    });
  });

  describe('notifyMatchingBuyers — only currently-active premium subscribers are notified', () => {
    const listing = {
      id: 'l1',
      slug: 'test-listing',
      title: 'Test listing',
      category: 'apartment',
      transactionType: 'rent',
      cityId: 'city1',
      city: { name: 'Bengaluru' },
      areaId: 'area1',
      area: { name: 'Indiranagar' },
      price: 20000,
      attributes: { bedrooms: 2 },
    } as unknown as Listing & { city: City; area: Area };

    it('matches free alerts unconditionally and plus alerts only while the subscription is live', async () => {
      const { service, prisma } = makeService();
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([]);
      await service.notifyMatchingBuyers(listing);
      const [args] = (prisma.savedSearch.findMany as jest.Mock).mock.calls[0];

      // A free alert was promised to someone who never paid, so it has to fire regardless of
      // subscription state — silently never firing would be worse than not offering it. A plus
      // alert is tied to the subscription that bought it, so a lapse keeps the free allowance
      // working and drops the rest. See SavedSearch.source.
      expect(args.where.OR).toEqual([
        { source: 'free' },
        { user: { premiumUntil: { gt: expect.any(Date) } } },
      ]);
    });

    it('notifies only the candidates whose saved bedrooms filter matches the listing', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([
        { id: 'sA', bedrooms: 2, user: { id: 'buyerA', name: 'A', email: 'a@x.com', phone: null } },
        { id: 'sB', bedrooms: 3, user: { id: 'buyerB', name: 'B', email: 'b@x.com', phone: null } },
        { id: 'sC', bedrooms: null, user: { id: 'buyerC', name: 'C', email: 'c@x.com', phone: null } },
      ]);
      await service.notifyMatchingBuyers(listing);

      expect(notificationsService.notifySavedSearchMatch).toHaveBeenCalledTimes(2);
      const notifiedUserIds = (notificationsService.notifySavedSearchMatch as jest.Mock).mock.calls.map(
        ([user]: [{ id: string }]) => user.id,
      );
      expect(notifiedUserIds.sort()).toEqual(['buyerA', 'buyerC']);
      expect(prisma.savedSearch.update).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no saved search candidates match', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([]);
      await service.notifyMatchingBuyers(listing);
      expect(notificationsService.notifySavedSearchMatch).not.toHaveBeenCalled();
      expect(prisma.savedSearch.update).not.toHaveBeenCalled();
    });
  });
});
