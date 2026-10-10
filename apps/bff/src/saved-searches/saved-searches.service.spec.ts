import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SavedSearchesService } from './saved-searches.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from '../locations/locations.service';
import type { Area, City, Listing } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService(
  options: {
    freeUsed?: number;
    freeAlertsPerUser?: number;
    areas?: { id: string; name: string }[];
    ensureArea?: jest.Mock;
  } = {},
) {
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
    // toDto resolves area *names* for whatever ids a row's areaIds carries — no rows here need a
    // real name, so an empty result (and "(deleted area)" for any id it can't find) is fine.
    area: { findMany: jest.fn().mockResolvedValue(options.areas ?? []) },
    listingNotificationLog: { create: jest.fn() },
  } as unknown as PrismaService;
  const notificationsService = { notifySavedSearchMatch: jest.fn() } as unknown as NotificationsService;
  const locationsService = { ensureArea: options.ensureArea ?? jest.fn() } as unknown as LocationsService;

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
        areaIds: [], minPrice: null, maxPrice: null, bedroomOptions: [], createdAt: new Date(),
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
        areaIds: [], minPrice: null, maxPrice: null, bedroomOptions: [], createdAt: new Date(),
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
        areaIds: [],
        minPrice: null,
        maxPrice: null,
        bedroomOptions: [],
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
        { id: 'sA', bedroomOptions: [2], user: { id: 'buyerA', name: 'A', email: 'a@x.com', phone: null } },
        { id: 'sB', bedroomOptions: [3], user: { id: 'buyerB', name: 'B', email: 'b@x.com', phone: null } },
        { id: 'sC', bedroomOptions: [], user: { id: 'buyerC', name: 'C', email: 'c@x.com', phone: null } },
      ]);
      await service.notifyMatchingBuyers(listing);

      expect(notificationsService.notifySavedSearchMatch).toHaveBeenCalledTimes(2);
      const notifiedUserIds = (notificationsService.notifySavedSearchMatch as jest.Mock).mock.calls.map(
        ([user]: [{ id: string }]) => user.id,
      );
      expect(notifiedUserIds.sort()).toEqual(['buyerA', 'buyerC']);
      expect(prisma.savedSearch.update).toHaveBeenCalledTimes(2);
    });

    it('logs the matched seeker as the recipient, not the listing owner', async () => {
      const { service, prisma, notificationsService } = makeService();
      (
        notificationsService.notifySavedSearchMatch as jest.Mock
      ).mockResolvedValue('email');
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sA',
          bedroomOptions: [],
          user: { id: 'buyerA', name: 'A', email: 'a@x.com', phone: null },
        },
      ]);
      await service.notifyMatchingBuyers(listing);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
        data: {
          listingId: 'l1',
          kind: 'saved_search_match',
          channel: 'email',
          userId: 'buyerA',
        },
      });
    });

    it('does nothing when no saved search candidates match', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([]);
      await service.notifyMatchingBuyers(listing);
      expect(notificationsService.notifySavedSearchMatch).not.toHaveBeenCalled();
      expect(prisma.savedSearch.update).not.toHaveBeenCalled();
    });

    /** The top bucket means "N or more", not exactly N — same convention as the browse filter's
     * own BHK buckets (ListingsService.list()). A 6-bedroom listing must still find a seeker whose
     * alert says "5+", or the biggest homes would never match anyone's alert at all. */
    it('treats the top bucket (5) as "5 or more", not exactly 5', async () => {
      const { service, prisma, notificationsService } = makeService();
      const bigListing = { ...listing, attributes: { bedrooms: 6 } } as unknown as Listing & { city: City; area: Area };
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([
        { id: 'sBig', bedroomOptions: [5], user: { id: 'buyerBig', name: 'Big', email: 'b@x.com', phone: null } },
        { id: 'sExact5', bedroomOptions: [5], user: { id: 'buyerExact', name: 'E', email: 'e@x.com', phone: null } },
      ]);
      await service.notifyMatchingBuyers(bigListing);
      // Both rows say "5", and both should match a 6-bedroom listing — there is only one bucket
      // ("5+"), not a separate "exactly 5" vs "6 or more".
      expect(notificationsService.notifySavedSearchMatch).toHaveBeenCalledTimes(2);
    });

    it('never matches when the listing category has no bedroom count at all', async () => {
      const { service, prisma, notificationsService } = makeService();
      const plot = { ...listing, attributes: {} } as unknown as Listing & { city: City; area: Area };
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([
        { id: 's2bhk', bedroomOptions: [2], user: { id: 'buyer2bhk', name: 'X', email: 'x@x.com', phone: null } },
        { id: 'sAny', bedroomOptions: [], user: { id: 'buyerAny', name: 'Y', email: 'y@x.com', phone: null } },
      ]);
      await service.notifyMatchingBuyers(plot);
      // "Any" still matches (it never asked about bedrooms); a specific bucket cannot, since
      // there is nothing to compare it against.
      const notified = (notificationsService.notifySavedSearchMatch as jest.Mock).mock.calls.map(([u]: [{ id: string }]) => u.id);
      expect(notified).toEqual(['buyerAny']);
    });
  });

  describe('create — price range and multi-area', () => {
    it('rejects minPrice greater than maxPrice', async () => {
      const { service, prisma } = makeService();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      await expect(
        service.create('u1', { name: 'x', minPrice: 50000, maxPrice: 20000 } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.savedSearch.create).not.toHaveBeenCalled();
    });

    it('composes areaIds with a newly typed areaName rather than replacing it', async () => {
      const ensureArea = jest.fn().mockResolvedValue({ id: 'a3' });
      const { service, prisma } = makeService({ ensureArea });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      (prisma.savedSearch.create as jest.Mock).mockResolvedValue({
        id: 's1', name: 'x', category: null, transactionType: null, cityId: 'c1', city: { name: 'Bengaluru' },
        areaIds: ['a1', 'a2', 'a3'], minPrice: null, maxPrice: null, bedroomOptions: [], createdAt: new Date(),
      });

      await service.create('u1', { name: 'x', cityId: 'c1', areaIds: ['a1', 'a2'], areaName: 'New Layout' } as any);

      expect(ensureArea).toHaveBeenCalledWith('c1', 'New Layout');
      expect((prisma.savedSearch.create as jest.Mock).mock.calls[0][0].data.areaIds).toEqual(['a1', 'a2', 'a3']);
    });

    it('caps the combined area list at MAX_REQUIREMENT_AREAS', async () => {
      const ensureArea = jest.fn().mockResolvedValue({ id: 'a6' });
      const { service, prisma } = makeService({ ensureArea });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      (prisma.savedSearch.create as jest.Mock).mockResolvedValue({
        id: 's1', name: 'x', category: null, transactionType: null, cityId: 'c1', city: null,
        areaIds: ['a1', 'a2', 'a3', 'a4', 'a5'], minPrice: null, maxPrice: null, bedroomOptions: [], createdAt: new Date(),
      });

      await service.create('u1', {
        name: 'x',
        cityId: 'c1',
        areaIds: ['a1', 'a2', 'a3', 'a4', 'a5'],
        areaName: 'One Too Many',
      } as any);

      expect((prisma.savedSearch.create as jest.Mock).mock.calls[0][0].data.areaIds).toEqual([
        'a1', 'a2', 'a3', 'a4', 'a5',
      ]);
    });

    it('resolves every area\'s name for a multi-area result', async () => {
      const { service, prisma } = makeService({ areas: [{ id: 'a1', name: 'Koramangala' }, { id: 'a2', name: 'Indiranagar' }] });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      (prisma.savedSearch.create as jest.Mock).mockResolvedValue({
        id: 's1', name: 'x', category: null, transactionType: null, cityId: 'c1', city: { name: 'Bengaluru' },
        areaIds: ['a1', 'a2'], minPrice: 10000, maxPrice: 20000, bedroomOptions: [2, 3], createdAt: new Date(),
      });

      const result = await service.create('u1', { name: 'x', cityId: 'c1', areaIds: ['a1', 'a2'] } as any);

      expect(result.areaNames).toEqual(['Koramangala', 'Indiranagar']);
      expect(result.bedroomOptions).toEqual([2, 3]);
    });
  });
});
