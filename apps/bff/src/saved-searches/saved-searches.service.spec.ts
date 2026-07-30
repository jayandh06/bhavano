import { ForbiddenException } from '@nestjs/common';
import { SavedSearchesService } from './saved-searches.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from '../locations/locations.service';
import type { Listing } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;
const future = (hours = 1) => new Date(Date.now() + hours * HOUR_MS);
const past = (hours = 1) => new Date(Date.now() - hours * HOUR_MS);

function makeService() {
  const prisma = {
    user: { findUnique: jest.fn() },
    savedSearch: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  } as unknown as PrismaService;
  const notificationsService = { notifySavedSearchMatch: jest.fn() } as unknown as NotificationsService;
  const locationsService = {} as LocationsService;

  const service = new SavedSearchesService(prisma, notificationsService, locationsService);
  return { service, prisma, notificationsService };
}

describe('SavedSearchesService', () => {
  describe('create — Bhavano Plus (premiumUntil) gating', () => {
    it('rejects a never-subscribed user (premiumUntil: null)', async () => {
      const { service, prisma } = makeService();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: null });
      await expect(service.create('u1', { name: 'My search' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a lapsed subscriber (premiumUntil in the past)', async () => {
      const { service, prisma } = makeService();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ premiumUntil: past() });
      await expect(service.create('u1', { name: 'My search' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the user cannot be found', async () => {
      const { service, prisma } = makeService();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.create('u1', { name: 'My search' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

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
      category: 'apartment',
      transactionType: 'rent',
      cityId: 'city1',
      areaId: 'area1',
      price: 20000,
      attributes: { bedrooms: 2 },
    } as unknown as Listing;

    it('queries candidates filtered to users with an active premiumUntil', async () => {
      const { service, prisma } = makeService();
      (prisma.savedSearch.findMany as jest.Mock).mockResolvedValue([]);
      await service.notifyMatchingBuyers(listing);
      const [args] = (prisma.savedSearch.findMany as jest.Mock).mock.calls[0];
      expect(args.where.user).toEqual({ premiumUntil: { gt: expect.any(Date) } });
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
