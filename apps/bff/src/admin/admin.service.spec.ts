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
import { ACTIVE_PROMO_CODE } from '@bhavano/types/promoCode';

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
    listingNotificationLog: { create: jest.fn(), createMany: jest.fn() },
    // The promotion quotes the live promo's price — no row means the plain, no-offer wording.
    discountCode: { findUnique: jest.fn().mockResolvedValue(null) },
    message: { findMany: jest.fn().mockResolvedValue([]) },
    favourite: { findMany: jest.fn().mockResolvedValue([]) },
    listingView: { findMany: jest.fn().mockResolvedValue([]) },
    visit: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;

  const notificationsService = {
    notifyListingPosted: jest.fn().mockResolvedValue({ channel: 'email' }),
    notifyBoostPromotion: jest.fn().mockResolvedValue([{ channel: 'email' }]),
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
    { getSettings: jest.fn().mockResolvedValue({ propertyListingFee: 0, coworkingPgStorageListingFee: 0, furnitureInteriorsListingFee: 0 }) } as unknown as import('../plans/platform-fee-settings.service').PlatformFeeSettingsService,
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
      // apartment is a property-tier category, so the 7-day entry price, from settings. No promo
      // row in the default stub, so full price and no offer wording.
      { boostPrice: 199, bundlePrice: 224, boostDays: 7, alertsPrice: 25 },
    );
    expect(prisma.listingNotificationLog.createMany).toHaveBeenCalledWith({
      data: [{ listingId: 'listing1', kind: 'boost_promo', channel: 'email', providerMessageId: null }],
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
      { notifyBoostPromotion: jest.fn().mockResolvedValue([]) },
    );

    const result = await service.sendBoostPromotion(['listing1']);

    expect(prisma.listingNotificationLog.createMany).not.toHaveBeenCalled();
    expect(result.results[0].error).toContain('MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME');
  });

  it('quotes the discounted price, the original, and the end date while the promo is live', async () => {
    const { service, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow()]) },
      discountCode: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          code: ACTIVE_PROMO_CODE,
          discountPercent: 50,
          active: true,
          expiresAt: new Date('2026-09-30T18:29:59Z'),
        }),
      },
    });

    await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        // ₹199 boost, ₹25 alerts, both halved and rounded the way the preview screen rounds.
        boostPrice: 100,
        bundlePrice: 112,
        boostDays: 7,
        alertsPrice: 25,
        offer: {
          discountPercent: 50,
          boostBasePrice: 199,
          bundleBasePrice: 224,
          // IST, so the UTC 18:29:59 instant is still the 30th and not the 1st.
          endsOn: '30 September',
        },
      },
    );
  });

  it.each([
    ['inactive', { active: false, expiresAt: null }],
    ['expired', { active: true, expiresAt: new Date('2020-01-01T00:00:00Z') }],
  ])('falls back to full price and no offer wording when the promo is %s', async (_label, overrides) => {
    const { service, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow()]) },
      discountCode: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'd1', code: ACTIVE_PROMO_CODE, discountPercent: 50, ...overrides }),
      },
    });

    await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { boostPrice: 199, bundlePrice: 224, boostDays: 7, alertsPrice: 25 },
    );
  });

  it('says "while it lasts" for an open-ended promo rather than inventing a date', async () => {
    const { service, notificationsService } = makeService({
      listing: { findMany: jest.fn().mockResolvedValue([listingRow()]) },
      discountCode: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'd1', code: ACTIVE_PROMO_CODE, discountPercent: 20, active: true, expiresAt: null }),
      },
    });

    await service.sendBoostPromotion(['listing1']);

    expect(notificationsService.notifyBoostPromotion).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ offer: expect.objectContaining({ endsOn: 'while it lasts' }) }),
    );
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

describe('AdminService.listRecentLogins — one row per user, not per LoginEvent', () => {
  function runQuery(overrides: {
    grouped: unknown[];
    lastEvents?: unknown[];
    visits?: unknown[];
    listingOwners?: unknown[];
    users?: unknown[];
  }) {
    return makeService({
      loginEvent: {
        groupBy: jest.fn().mockResolvedValue(overrides.grouped),
        findMany: jest.fn().mockResolvedValue(overrides.lastEvents ?? []),
      },
      visit: { findMany: jest.fn().mockResolvedValue(overrides.visits ?? []) },
      listing: { findMany: jest.fn().mockResolvedValue(overrides.listingOwners ?? []) },
      user: { findMany: jest.fn().mockResolvedValue(overrides.users ?? []) },
    });
  }

  it('builds a full per-user summary: first/last login, isNewUser, last method+device, hasPostedAd', async () => {
    const { service, prisma } = runQuery({
      // u1's first login is a full month before its last — a returning user. u2's first and
      // last login are the exact same instant — logged in exactly once, ever.
      grouped: [
        { userId: 'u1', _min: { createdAt: new Date('2026-01-01T00:00:00Z') }, _max: { createdAt: new Date('2026-02-01T00:00:00Z') } },
        { userId: 'u2', _min: { createdAt: new Date('2026-02-01T00:00:00Z') }, _max: { createdAt: new Date('2026-02-01T00:00:00Z') } },
      ],
      lastEvents: [
        { userId: 'u1', method: 'google', sessionId: 'sess1' },
        { userId: 'u2', method: 'otp', sessionId: null },
      ],
      visits: [{ sessionId: 'sess1', deviceType: 'desktop' }],
      listingOwners: [{ ownerId: 'u1' }],
      users: [
        { id: 'u1', name: 'Returning User', phone: '+911', email: null },
        { id: 'u2', name: 'Brand New User', phone: '+912', email: null },
      ],
    });

    const result = await service.listRecentLogins({ limit: 25 } as Parameters<typeof service.listRecentLogins>[0]);

    const u1 = result.items.find((i) => i.userId === 'u1');
    const u2 = result.items.find((i) => i.userId === 'u2');
    expect(u1).toMatchObject({ isNewUser: false, lastLoginMethod: 'google', lastLoginDevice: 'desktop', hasPostedAd: true });
    expect(u2).toMatchObject({ isNewUser: true, lastLoginMethod: 'otp', lastLoginDevice: null, hasPostedAd: false });
    // u2's last login had no sessionId at all (a mobile-app login) — Visit is never even queried
    // for it, since there's nothing to join against.
    expect(prisma.visit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionId: { in: ['sess1'] } } }));
  });

  it('returns empty immediately when no user has ever logged in, without querying anything else', async () => {
    const { service, prisma } = runQuery({ grouped: [] });

    const result = await service.listRecentLogins({ limit: 25 } as Parameters<typeof service.listRecentLogins>[0]);

    expect(result).toEqual({ items: [], total: 0 });
    expect(prisma.loginEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('filters on hasPostedAd and isNewUser as boolean-string query params, and sorts by userName', async () => {
    const { service } = runQuery({
      grouped: [
        { userId: 'u1', _min: { createdAt: new Date('2026-01-01T00:00:00Z') }, _max: { createdAt: new Date('2026-02-01T00:00:00Z') } },
        { userId: 'u2', _min: { createdAt: new Date('2026-02-05T00:00:00Z') }, _max: { createdAt: new Date('2026-02-05T00:00:00Z') } },
        { userId: 'u3', _min: { createdAt: new Date('2026-02-01T00:00:00Z') }, _max: { createdAt: new Date('2026-02-01T00:00:00Z') } },
      ],
      lastEvents: [
        { userId: 'u1', method: 'otp', sessionId: null },
        { userId: 'u2', method: 'otp', sessionId: null },
        { userId: 'u3', method: 'otp', sessionId: null },
      ],
      listingOwners: [{ ownerId: 'u1' }, { ownerId: 'u3' }],
      users: [
        { id: 'u1', name: 'Zed', phone: null, email: null },
        { id: 'u2', name: 'Amy', phone: null, email: null },
        { id: 'u3', name: 'Mo', phone: null, email: null },
      ],
    });

    const result = await service.listRecentLogins({
      hasPostedAd: 'true',
      isNewUser: 'false',
      sort: 'userName_asc',
      limit: 25,
    } as Parameters<typeof service.listRecentLogins>[0]);

    // u2 (no ad) and u3 (a new user, first login === last login) are both filtered out — only
    // u1 (has an ad, and a real returning user) survives.
    expect(result.items.map((i) => i.userId)).toEqual(['u1']);
  });

  /** The correctness fix `from`/`to` being pushed into the groupBy's own `where` required: once
   * a date range narrows which LoginEvent rows the aggregate even sees, a returning user's
   * windowed first and last can coincide (only their one recent login is visible to the
   * windowed query) even though they are not new at all — a second `groupBy` scoped to just the
   * users in the windowed result, unrestricted by date, is what tells the two cases apart. */
  it('does not call a returning user "new" just because a date window hid their earlier login', async () => {
    let call = 0;
    const groupBy = jest.fn().mockImplementation(() => {
      call += 1;
      // Call 1: the windowed groupBy — u1's older login (months ago) falls outside the
      // window, so only yesterday's is visible, making windowed first === windowed last.
      if (call === 1) {
        return Promise.resolve([
          { userId: 'u1', _min: { createdAt: new Date('2026-02-20T00:00:00Z') }, _max: { createdAt: new Date('2026-02-20T00:00:00Z') } },
          { userId: 'u2', _min: { createdAt: new Date('2026-02-20T00:00:00Z') }, _max: { createdAt: new Date('2026-02-20T00:00:00Z') } },
        ]);
      }
      // Call 2: the true-all-time-first lookup — u1's real first login was months earlier;
      // u2 really did only ever log in once, so their true first matches the windowed one.
      return Promise.resolve([
        { userId: 'u1', _min: { createdAt: new Date('2025-11-01T00:00:00Z') } },
        { userId: 'u2', _min: { createdAt: new Date('2026-02-20T00:00:00Z') } },
      ]);
    });

    const { service } = makeService({
      loginEvent: { groupBy, findMany: jest.fn().mockResolvedValue([]) },
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      listing: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await service.listRecentLogins({
      from: '2026-02-19T00:00:00.000Z',
      to: '2026-02-21T00:00:00.000Z',
      limit: 25,
    } as Parameters<typeof service.listRecentLogins>[0]);

    const u1 = result.items.find((i) => i.userId === 'u1');
    const u2 = result.items.find((i) => i.userId === 'u2');
    expect(u1?.isNewUser).toBe(false); // returning user, older login just outside the window
    expect(u2?.isNewUser).toBe(true); // genuinely only ever logged in once, within the window
    expect(groupBy).toHaveBeenCalledTimes(2);
  });
});
