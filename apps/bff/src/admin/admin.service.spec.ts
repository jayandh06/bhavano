import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import { BoostPricingSettingsService } from '../plans/boost-pricing-settings.service';
import { SubscriptionPlanSettingsService } from '../plans/subscription-plan-settings.service';
import { InstantAlertsPricingSettingsService } from '../plans/instant-alerts-pricing-settings.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import type { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { DEFAULT_BOOST_PRICE_SETTINGS } from '@bhavano/types/boostPricing';
import { DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS } from '@bhavano/types/instantAlertsPricing';

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
    notifyBoostPromotion: jest.fn().mockResolvedValue('email'),
    ...notificationsOverrides,
  } as unknown as NotificationsService;

  // The promotion quotes live prices, so these two are real stubs rather than `{}` — see
  // AdminService.sendBoostPromotion on why the figure comes from settings and not the copy.
  const boostPricingSettingsService = {
    getSettings: jest.fn().mockResolvedValue(DEFAULT_BOOST_PRICE_SETTINGS),
  } as unknown as BoostPricingSettingsService;
  const instantAlertsPricingSettingsService = {
    getSettings: jest.fn().mockResolvedValue(DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS),
  } as unknown as InstantAlertsPricingSettingsService;

  const service = new AdminService(
    prisma,
    {} as ListingsService,
    {} as MessagingService,
    notificationsService,
    {} as RateLimitService,
    {} as ContactRevealService,
    boostPricingSettingsService,
    {} as SubscriptionPlanSettingsService,
    instantAlertsPricingSettingsService,
    {} as AccountDeletionService,
    {} as SavedSearchesService,
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
    // Live by default — the promotion refuses anything that isn't.
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    boostedUntil: null,
    instantAlertsUntil: null,
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

/** The promotion is marketing, so what is worth pinning is mostly what it *refuses* to send. A
 * pitch that arrives twice, or lands on an ad that is already boosted, or on an expired one, costs
 * more trust than the sale is worth. */
describe('AdminService.sendBoostPromotion', () => {
  it('sends, quotes the live prices, and logs a boost_promo row', async () => {
    const { service, prisma, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow()]) },
    });

    const result = await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).toHaveBeenCalledWith(
      { name: 'Owner', email: 'owner@example.com', phone: '+919876543210' },
      { id: 'listing1', title: 'A listing', cityName: 'Bengaluru', area: 'Koramangala' },
      // apartment is a property-tier category, so the 7-day entry price, from settings.
      { boostPrice: 199, boostDays: 7, alertsPrice: 25 },
    );
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
      data: { listingId: 'listing1', kind: 'boost_promo', channel: 'email' },
    });
    expect(result).toEqual({ sent: 1, failed: 0, results: [{ listingId: 'listing1', success: true }] });
  });

  it('prices by category tier, so a furniture ad is not quoted an apartment price', async () => {
    const { service, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow({ category: 'furniture' })]) },
    });

    await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ boostPrice: 49 }),
    );
  });

  it('refuses to promote an ad promoted inside the cooldown', async () => {
    const { service, notificationsService, prisma } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow({ notificationLogs: [{ id: 'log1' }] })]) },
    });

    const result = await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).not.toHaveBeenCalled();
    expect(result.results[0].error).toBe('Promoted in the last 14 days');
    // And the cooldown is a *window*, not "ever": the query only looks back that far.
    const where = (prisma.listing.findMany as jest.Mock).mock.calls[0][0].include.notificationLogs.where;
    expect(where.kind).toBe('boost_promo');
    expect(where.sentAt.gte).toBeInstanceOf(Date);
    expect(Date.now() - (where.sentAt.gte as Date).getTime()).toBeCloseTo(14 * 24 * 60 * 60 * 1000, -4);
  });

  it.each([
    ['sold', { status: 'sold' }],
    ['expired', { expiresAt: new Date(Date.now() - 1000) }],
  ])('refuses to sell a boost for an ad that is %s', async (_label, overrides) => {
    const { service, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow(overrides)]) },
    });

    const result = await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).not.toHaveBeenCalled();
    expect(result.results[0].error).toBe('Not a live listing — nothing to promote');
  });

  it('skips an ad that already has both boost and Instant Alerts — nothing left to offer', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const { service, notificationsService } = makeService({
      listing: {
        findMany: jest.fn().mockResolvedValue([listingRow({ boostedUntil: future, instantAlertsUntil: future })]),
      },
    });

    const result = await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).not.toHaveBeenCalled();
    expect(result.results[0].error).toBe('Already boosted and on Instant Alerts');
  });

  it('still promotes Instant Alerts to an ad that is boosted but has no alerts', async () => {
    const { service, notificationsService } = makeService({
      listing: {
        findMany: jest
          .fn()
          .mockResolvedValue([listingRow({ boostedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) })]),
      },
    });

    const result = await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });

  it('skips the bulk-import placeholder owner', async () => {
    const { service, notificationsService } = makeService({
      listing: {
        findMany: jest
          .fn()
          .mockResolvedValue([listingRow({ owner: { name: null, email: null, phone: '9000000002' } })]),
      },
    });

    const result = await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).not.toHaveBeenCalled();
    expect(result.results[0].error).toBe('Bulk-import placeholder owner — no real recipient');
  });

  it('names the missing WhatsApp template when a phone-only owner cannot be reached', async () => {
    const { service, prisma } = makeService(
      {
        listing: {
          findMany: jest
            .fn()
            .mockResolvedValue([listingRow({ owner: { name: 'Ravi', email: null, phone: '+919876543210' } })]),
        },
      },
      { notifyBoostPromotion: jest.fn().mockResolvedValue(null) },
    );

    const result = await service.sendBoostPromotion(['listing1']);

    expect(prisma.listingNotificationLog.create).not.toHaveBeenCalled();
    expect(result.results[0].error).toContain('WHATSAPP_BOOST_PROMO_TEMPLATE');
  });

  it('processes a mixed batch independently', async () => {
    const { service } = makeService({
      listing: {
        findMany: jest.fn().mockResolvedValue([
          listingRow({ id: 'recent', notificationLogs: [{ id: 'log1' }] }),
          listingRow({ id: 'fresh' }),
        ]),
      },
    });

    const result = await service.sendBoostPromotion(['recent', 'fresh', 'missing']);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.results.find((r) => r.listingId === 'fresh')?.success).toBe(true);
    expect(result.results.find((r) => r.listingId === 'missing')?.error).toBe('Listing not found');
  });
});
