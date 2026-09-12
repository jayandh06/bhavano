import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import { AccountDeletionService } from '../users/account-deletion.service';

function makeService(overrides: Record<string, unknown> = {}) {
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
    message: { findMany: jest.fn().mockResolvedValue([]) },
    favourite: { findMany: jest.fn().mockResolvedValue([]) },
    listingView: { findMany: jest.fn().mockResolvedValue([]) },
    visit: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;

  const service = new AdminService(
    prisma,
    {} as ListingsService,
    {} as MessagingService,
    {} as NotificationsService,
    {} as RateLimitService,
    {} as ContactRevealService,
    {} as AccountDeletionService,
  );
  return { service, prisma };
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
