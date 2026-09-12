import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import { AccountDeletionService } from '../users/account-deletion.service';

function makeService(overrides: Record<string, unknown> = {}, notificationsOverrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        name: 'Test User',
        phone: '+919876543210',
        email: null,
        role: 'user',
        createdAt: new Date('2026-01-01'),
        acquisitionSource: null,
        acquisitionMedium: null,
        acquisitionCampaign: null,
        city: null,
      }),
    },
    loginEvent: { findMany: jest.fn().mockResolvedValue([]) },
    listing: { findMany: jest.fn().mockResolvedValue([]) },
    listingEditLog: { findMany: jest.fn().mockResolvedValue([]) },
    listingNotificationLog: { create: jest.fn() },
    message: { findMany: jest.fn().mockResolvedValue([]) },
    favourite: { findMany: jest.fn().mockResolvedValue([]) },
    listingView: { findMany: jest.fn().mockResolvedValue([]) },
    visit: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;

  const notificationsService = {
    notifyListingPosted: jest.fn().mockResolvedValue({ channel: 'email' }),
    ...notificationsOverrides,
  } as unknown as NotificationsService;

  const service = new AdminService(
    prisma,
    {} as ListingsService,
    {} as MessagingService,
    notificationsService,
    {} as RateLimitService,
    {} as ContactRevealService,
    {} as AccountDeletionService,
  );
  return { service, prisma, notificationsService };
}

function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing1',
    slug: 'a-listing',
    category: 'apartment',
    transactionType: 'rent',
    title: 'A listing',
    city: { name: 'Bengaluru' },
    area: { name: 'Koramangala' },
    owner: { name: 'Owner', email: 'owner@example.com', phone: '+919876543210' },
    notificationLogs: [],
    ...overrides,
  };
}

describe("AdminService.getUserActivity — 'Updated listing' reflects a real edit", () => {
  it('shows an Updated listing event only for a real ListingEditLog "updated" row', async () => {
    const { service, prisma } = makeService({
      listingEditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log1',
            listingId: 'listing1',
            createdAt: new Date('2026-09-12T12:02:00Z'),
            listing: { title: 'It\'s a good house with a commercial ground floor' },
          },
        ]),
      },
    });

    const result = await service.getUserActivity('u1');

    const updateEvents = result.events.filter((e) => e.type === 'listing_updated');
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0].summary).toBe('Updated listing "It\'s a good house with a commercial ground floor"');
    expect(updateEvents[0].timestamp).toBe('2026-09-12T12:02:00.000Z');

    // The real bug this replaces: listingEditLog.findMany is what's actually queried now, not
    // a comparison of the Listing row's own updatedAt/createdAt (which view/like counters and
    // boost rotation all bump too, regardless of whether the content changed at all).
    expect(prisma.listingEditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorId: 'u1', actorType: 'owner', action: 'updated' } }),
    );
  });

  it('a freshly-posted, never-edited listing shows no Updated listing event at all', async () => {
    // Regression case: previously, viewing your own new listing (bumping viewCount, which bumps
    // Listing.updatedAt via Prisma's own @updatedAt) was enough to make this fire, even though
    // nothing about the listing's content had changed.
    const { service } = makeService({
      listing: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'listing1', title: 'Never edited', createdAt: new Date('2026-09-12T06:26:18Z') },
        ]),
      },
      listingEditLog: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await service.getUserActivity('u1');

    expect(result.events.some((e) => e.type === 'listing_updated')).toBe(false);
  });
});

describe('AdminService.sendPostedNotification', () => {
  it('sends and logs a ListingNotificationLog row for a listing that has never had one', async () => {
    const { service, prisma, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow()]) },
    });

    const result = await service.sendPostedNotification(['listing1']);

    expect(notificationsService.notifyListingPosted).toHaveBeenCalledWith(
      { name: 'Owner', email: 'owner@example.com', phone: '+919876543210' },
      expect.objectContaining({ id: 'listing1', cityName: 'Bengaluru', area: 'Koramangala' }),
    );
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
      data: { listingId: 'listing1', kind: 'posted', channel: 'email', providerMessageId: null },
    });
    expect(result).toEqual({ sent: 1, failed: 0, results: [{ listingId: 'listing1', success: true }] });
  });

  it('skips a listing that already has a "posted" notification log, without sending again', async () => {
    const { service, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow({ notificationLogs: [{ id: 'log1' }] })]) },
    });

    const result = await service.sendPostedNotification(['listing1']);

    expect(notificationsService.notifyListingPosted).not.toHaveBeenCalled();
    expect(result).toEqual({
      sent: 0,
      failed: 1,
      results: [{ listingId: 'listing1', success: false, error: 'Already sent' }],
    });
  });

  it('skips the bulk-import placeholder owner — never a real recipient', async () => {
    const { service, notificationsService } = makeService({
      listing: {
        findMany: jest.fn().mockResolvedValue([
          listingRow({ owner: { name: null, email: null, phone: '9000000002' } }),
        ]),
      },
    });

    const result = await service.sendPostedNotification(['listing1']);

    expect(notificationsService.notifyListingPosted).not.toHaveBeenCalled();
    expect(result.results[0].error).toBe('Bulk-import placeholder owner — no real recipient');
  });

  it('records a failure, not a thrown error, when the owner has neither email nor phone', async () => {
    const { service, prisma } = makeService(
      {
        listing: {
          findMany: jest
            .fn()
            .mockResolvedValue([listingRow({ owner: { name: 'Ghost', email: null, phone: null } })]),
        },
      },
      { notifyListingPosted: jest.fn().mockResolvedValue(null) },
    );

    const result = await service.sendPostedNotification(['listing1']);

    expect(prisma.listingNotificationLog.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      sent: 0,
      failed: 1,
      results: [{ listingId: 'listing1', success: false, error: 'Owner has no email or phone on file' }],
    });
  });

  it('reports "Listing not found" for an id that no longer resolves to a row', async () => {
    const { service } = makeService({ listing: { findMany: jest.fn().mockResolvedValue([]) } });

    const result = await service.sendPostedNotification(['missing1']);

    expect(result).toEqual({
      sent: 0,
      failed: 1,
      results: [{ listingId: 'missing1', success: false, error: 'Listing not found' }],
    });
  });

  it('processes a mixed batch independently — one already sent, one fresh', async () => {
    const { service } = makeService({
      listing: {
        findMany: jest.fn().mockResolvedValue([
          listingRow({ id: 'already', notificationLogs: [{ id: 'log1' }] }),
          listingRow({ id: 'fresh' }),
        ]),
      },
    });

    const result = await service.sendPostedNotification(['already', 'fresh']);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results.find((r) => r.listingId === 'fresh')?.success).toBe(true);
    expect(result.results.find((r) => r.listingId === 'already')?.error).toBe('Already sent');
  });
});
