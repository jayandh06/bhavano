import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingsService, recentMixGroupKey, resolveDeclaredSellerType, roundRobinByGroup } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { BULK_IMPORT_OWNER_PHONE } from './bulk-import-owner';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { LocationsService } from '../locations/locations.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { CdnPurgeService } from '../storage/cdn-purge.service';
import { ListingSlotsService } from '../listing-slots/listing-slots.service';
import { PlatformFeeSettingsService } from '../plans/platform-fee-settings.service';
import { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { ReferralsService } from '../referrals/referrals.service';
import { ConfigService } from '@nestjs/config';
import {
  brokerageFeeIssue,
  brokerageFeeNote,
  normalizeBrokerageAttributes,
} from '@bhavano/types/categoryFields';
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
    listing: { update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    listingRenewal: { create: jest.fn() },
    listingEditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    listingInterest: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    listingNotificationLog: { create: jest.fn() },
    listingView: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
    // First-photo lookup for the like/view push's preview image — null = no image.
    listingPhoto: { findFirst: jest.fn().mockResolvedValue(null) },
    conversation: { findMany: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const notificationsService = {
    notifyListingLiked: jest.fn(),
    notifyListingInterest: jest.fn(),
  } as unknown as NotificationsService;
  const listingSlotsService = {
    assertCanRenew: jest.fn(),
  } as unknown as ListingSlotsService;
  const referralsService = {
    recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined),
    revokeIfTakenDown: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReferralsService;
  // Defaults to "no device" (undefined/falsy), matching every existing test's expectation that
  // the real-time push leg never logs by default — override per-test to exercise the logging.
  const pushService = {
    notifyListingInterest: jest.fn().mockResolvedValue(undefined),
    notifyListingFavourite: jest.fn().mockResolvedValue(undefined),
  };

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
    {
      getSettings: jest.fn().mockResolvedValue({
        propertyListingFee: 0,
        coworkingPgStorageListingFee: 0,
        furnitureInteriorsListingFee: 0,
        allowLivePublishWithPendingPayment: false,
      }),
    } as unknown as PlatformFeeSettingsService,
    pushService as never,
  { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
  referralsService,
  );
  return { service, prisma, notificationsService, listingSlotsService, referralsService, pushService };
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
      {
        getSettings: jest.fn().mockResolvedValue({
          propertyListingFee: 0,
          coworkingPgStorageListingFee: 0,
          furnitureInteriorsListingFee: 0,
        allowLivePublishWithPendingPayment: false,
        }),
      } as unknown as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
    { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
    { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined), revokeIfTakenDown: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService,
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

describe('ListingsService.list — amenity filter', () => {
  function makeListService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn<Promise<number>, [{ where: Prisma.ListingWhereInput }]>().mockResolvedValue(0);
    const prisma = {
      listing: { findMany, count },
      $queryRaw: jest.fn().mockResolvedValue([]),
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
      {
        getSettings: jest.fn().mockResolvedValue({
          propertyListingFee: 0,
          coworkingPgStorageListingFee: 0,
          furnitureInteriorsListingFee: 0,
        allowLivePublishWithPendingPayment: false,
        }),
      } as unknown as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
    { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
    { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined), revokeIfTakenDown: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService,
    );
    return { service, count };
  }

  /** The amenity clauses, wherever they ended up in the composed where. */
  function amenityClauses(where: Prisma.ListingWhereInput): unknown[] {
    const flat = JSON.stringify(where.AND ?? where);
    return (JSON.parse(flat) as unknown[]) ?? [];
  }

  it('ANDs one clause per ticked amenity — two boxes mean a place with both', async () => {
    const { service, count } = makeListService();

    await service.list({ amenities: ['lift', 'gym'], offset: 0, limit: 20 });

    const clauses = amenityClauses(count.mock.calls[0][0].where);
    expect(clauses).toEqual(
      expect.arrayContaining([
        { attributes: { path: ['lift'], equals: 'yes' } },
        { attributes: { path: ['gym'], equals: 'yes' } },
      ]),
    );
  });

  it('adds nothing at all when none are ticked', async () => {
    const { service, count } = makeListService();

    await service.list({ offset: 0, limit: 20 });

    expect(JSON.stringify(count.mock.calls[0][0].where)).not.toContain('"path"');
  });

  it('keeps amenity clauses separate from furnished, which lives in the same JSONB column', async () => {
    const { service, count } = makeListService();

    await service.list({ furnished: 'semi', amenities: ['lift'], offset: 0, limit: 20 });

    const clauses = amenityClauses(count.mock.calls[0][0].where);
    // Merged under one `attributes` key, the second would silently overwrite the first.
    expect(clauses).toEqual(
      expect.arrayContaining([
        { attributes: { path: ['furnished'], equals: 'semi' } },
        { attributes: { path: ['lift'], equals: 'yes' } },
      ]),
    );
  });
});

describe('ListingsService.list — no expiresAt visibility gate', () => {
  // See docs/plans/explicit-close-not-auto-expire.md: a listing only leaves the grid when its
  // own status changes, never just from age — so `list()`'s where clause must never filter on
  // expiresAt, only on status/publishState/moderationState.
  function makeListService() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn<Promise<number>, [{ where: Prisma.ListingWhereInput }]>().mockResolvedValue(0);
    const prisma = {
      listing: { findMany, count },
      $queryRaw: jest.fn().mockResolvedValue([]),
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
      {
        getSettings: jest.fn().mockResolvedValue({
          propertyListingFee: 0,
          coworkingPgStorageListingFee: 0,
          furnitureInteriorsListingFee: 0,
          allowLivePublishWithPendingPayment: false,
        }),
      } as unknown as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
      { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
      { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined), revokeIfTakenDown: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService,
    );
    return { service, count, findMany };
  }

  it('never includes expiresAt in the where clause, however old a listing is', async () => {
    const { service, count, findMany } = makeListService();

    await service.list({ offset: 0, limit: 20 });

    const where = count.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('expiresAt');
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('expiresAt');
    expect(where.status).toBe('active');
  });
});

describe('recentMixGroupKey', () => {
  it('groups All/Buy/Rent & Lease by property category, plus city when browsing all cities', () => {
    const listing = { category: 'apartment' as const, attributes: {}, cityId: 'city1' };
    expect(recentMixGroupKey(undefined, undefined, listing)).toBe('apartment::city1');
    expect(recentMixGroupKey('buy', undefined, listing)).toBe('apartment::city1');
    expect(recentMixGroupKey('rentLease', undefined, listing)).toBe('apartment::city1');
  });

  it('drops city from the key once a specific city is already the filter', () => {
    const listing = { category: 'apartment' as const, attributes: {}, cityId: 'city1' };
    expect(recentMixGroupKey(undefined, 'city1', listing)).toBe('apartment');
    expect(recentMixGroupKey('buy', 'city1', listing)).toBe('apartment');
  });

  it('groups PG by sharing-type facet, Furniture by condition, Interiors by service type', () => {
    expect(
      recentMixGroupKey('pg', undefined, { category: 'pg', attributes: { sharingType: ['double'] }, cityId: 'c1' }),
    ).toBe('double::c1');
    // sharingType is multi-select — a PG offering more than one groups under a stable,
    // order-independent key so "single+double" listings always land together regardless of
    // which order the array happens to be stored in.
    expect(
      recentMixGroupKey('pg', undefined, {
        category: 'pg',
        attributes: { sharingType: ['double', 'single'] },
        cityId: 'c1',
      }),
    ).toBe('double+single::c1');
    expect(
      recentMixGroupKey('pg', undefined, {
        category: 'pg',
        attributes: { sharingType: ['single', 'double'] },
        cityId: 'c1',
      }),
    ).toBe('double+single::c1');
    expect(
      recentMixGroupKey('furniture', undefined, {
        category: 'furniture',
        attributes: { condition: 'used' },
        cityId: 'c1',
      }),
    ).toBe('used::c1');
    expect(
      recentMixGroupKey('interiors', undefined, {
        category: 'interiors',
        attributes: { serviceType: 'painting' },
        cityId: 'c1',
      }),
    ).toBe('painting::c1');
  });

  it('falls back to "unspecified" for a facet-mixed tab when the listing has no facet value', () => {
    expect(recentMixGroupKey('pg', undefined, { category: 'pg', attributes: {}, cityId: 'c1' })).toBe(
      'unspecified::c1',
    );
  });
});

describe('roundRobinByGroup', () => {
  it('interleaves groups instead of letting one oversized group bury the rest', () => {
    // 5 pg rows (newest-first, p1..p5) and 1 house row (h1) — a bulk-import-shaped skew.
    const rows = ['p1', 'p2', 'p3', 'p4', 'p5', 'h1'].map((id) => ({
      id,
      group: id.startsWith('p') ? 'pg' : 'house',
    }));

    const result = roundRobinByGroup(rows, (r) => r.group);

    // pg's newest, then house's only row (round 1), then the rest of pg's rows in order.
    expect(result.map((r) => r.id)).toEqual(['p1', 'h1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('is a no-op when every row already belongs to the same group', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(roundRobinByGroup(rows, () => 'only-group').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves every row exactly once regardless of group sizes', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, group: `g${i % 3}` }));
    const result = roundRobinByGroup(rows, (r) => r.group);
    expect(result).toHaveLength(20);
    expect(new Set(result.map((r) => r.id)).size).toBe(20);
  });
});

describe('ListingsService.list — recent-listings mix (first 2 pages only)', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const now = Date.now();

  function row(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      category: 'apartment',
      transactionType: 'rent',
      slug: id,
      tag: 'FOR RENT',
      price: 10000,
      priceQualifier: '/month',
      title: id,
      area: { name: 'Some Area' },
      city: { name: 'Some City' },
      cityId: 'city1',
      ownerId: 'owner1',
      attributes: {},
      specs: [],
      listingPhotos: [],
      listingVideos: [],
      viewCount: 0,
      likeCount: 0,
      boostedUntil: null,
      createdAt: new Date(now - HOUR),
      boostRank: null,
      owner: { phone: null, email: null },
      ...overrides,
    };
  }

  function makeMixService(findManyImpl: (args: Record<string, unknown>) => unknown[]) {
    const findMany = jest.fn().mockImplementation(async (args: Record<string, unknown>) => findManyImpl(args));
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      listing: { findMany, count },
      favourite: { findMany: jest.fn().mockResolvedValue([]) },
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
      {
        getSettings: jest.fn().mockResolvedValue({
          propertyListingFee: 0,
          coworkingPgStorageListingFee: 0,
          furnitureInteriorsListingFee: 0,
        allowLivePublishWithPendingPayment: false,
        }),
      } as unknown as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
    { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
    { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined), revokeIfTakenDown: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService,
    );
    return { service, findMany };
  }

  it('puts every boosted match first, then round-robin-mixes the recent (unboosted) pool', async () => {
    const boosted = [row('boosted1', { boostRank: 0.9 })];
    // A skewed recent pool: 3 pg, 1 house — same shape as the real bulk-import incident.
    const recent = [
      row('pg1', { category: 'pg', attributes: { sharingType: ['single'] } }),
      row('pg2', { category: 'pg', attributes: { sharingType: ['single'] } }),
      row('pg3', { category: 'pg', attributes: { sharingType: ['single'] } }),
      row('house1', { category: 'house' }),
    ];

    const { service, findMany } = makeMixService((args) => {
      const where = args.where as Record<string, unknown>;
      if ((where.boostRank as { not: null })?.not === null) return boosted;
      if ((where.createdAt as { gte?: Date })?.gte) return recent;
      return []; // older-rows top-up
    });

    const result = await service.list({ offset: 0, limit: 4 } as never);

    expect(result.items.map((i) => i.id)).toEqual(['boosted1', 'pg1', 'house1', 'pg2']);
    // 3 findMany calls for the mixed path: boosted, recent pool, older top-up.
    expect(findMany).toHaveBeenCalledTimes(3);
  });

  it("gives the viewer their referral code on their own cards only, never on Bulk Import's", async () => {
    const recent = [
      row('mine'),
      row('theirs', { ownerId: 'someoneElse' }),
      row('bulk', { ownerId: 'owner1', owner: { phone: BULK_IMPORT_OWNER_PHONE, email: null } }),
    ];
    const { service } = makeMixService((args) =>
      ((args.where as Record<string, unknown>).createdAt as { gte?: Date })?.gte ? recent : [],
    );

    const result = await service.list({ offset: 0, limit: 12 } as never, 'owner1');
    const codeFor = (id: string) => result.items.find((i) => i.id === id)?.viewerReferralCode;

    expect(codeFor('mine')).toBe('owner1');
    expect(codeFor('theirs')).toBeUndefined();
    expect(codeFor('bulk')).toBeUndefined();
  });

  it('caps guaranteed-featured slots at a fraction of each page, not the whole window, so organic content always fills the rest', async () => {
    // 15 boosted listings — more than the per-page cap (a quarter of limit:12 = 3) — ranked by
    // boostRank, highest first, same as BoostRotationService's own random reshuffle would order
    // them. Same group (default category from `row()`), so round-robin is a no-op here.
    const boosted = Array.from({ length: 15 }, (_, i) =>
      row(`boost${i}`, { boostRank: 1 - i * 0.01, boostedUntil: new Date(now + DAY) }),
    );
    // Plenty of organic content — enough to fill both pages' non-featured slots, unlike a bare
    // couple of rows, so the test actually exercises "organic fills the rest of the page" rather
    // than silently running dry.
    const recent = Array.from({ length: 20 }, (_, i) => row(`organic${i}`, { category: 'house' }));

    const { service } = makeMixService((args) => {
      const where = args.where as Record<string, unknown>;
      if ((where.boostRank as { not: null })?.not === null) return boosted;
      if ((where.createdAt as { gte?: Date })?.gte) return recent;
      return [];
    });

    const page1 = await service.list({ offset: 0, limit: 12 } as never);
    const page2 = await service.list({ offset: 12, limit: 12 } as never);
    const page1Ids = page1.items.map((i) => i.id);
    const page2Ids = page2.items.map((i) => i.id);

    // Only 3 guaranteed featured slots per page — not the old whole-window cap of 12 — leaving 9
    // of every 12 slots for organic content, the actual fix for "page 1 was 100% featured ads".
    expect(page1Ids.slice(0, 3)).toEqual(['boost0', 'boost1', 'boost2']);
    expect(page1Ids.slice(3)).toEqual(expect.arrayContaining(['organic0', 'organic1']));
    expect(page2Ids.slice(0, 3)).toEqual(['boost3', 'boost4', 'boost5']);
    expect(page2Ids.slice(3).every((id) => id.startsWith('organic'))).toBe(true);
    // boost6-14 aren't dropped for missing the cap — they'd compete in the recent pool on their
    // own merits, same as before; this fixture just doesn't surface them there (see the dedicated
    // round-robin test below for one still carrying the badge past the cap).
    expect(new Set([...page1Ids, ...page2Ids]).size).toBe(page1Ids.length + page2Ids.length);
  });

  it("reserves the Featured rail's own slice before computing the grid's per-page cap", async () => {
    // Same 15 boosted listings as above, computed in the same single request this time
    // (featuredRailSize: 10) — the grid's own 3-per-page guarantee must come from what's left
    // after the rail's own 10 (boost10+), not re-promise the rail's own boost0-9 a slot here too.
    const boosted = Array.from({ length: 15 }, (_, i) =>
      row(`boost${i}`, { boostRank: 1 - i * 0.01, boostedUntil: new Date(now + DAY) }),
    );
    const recent = Array.from({ length: 20 }, (_, i) => row(`organic${i}`, { category: 'house' }));

    const { service } = makeMixService((args) => {
      const where = args.where as Record<string, unknown>;
      if ((where.boostRank as { not: null })?.not === null) return boosted;
      if ((where.createdAt as { gte?: Date })?.gte) return recent;
      return [];
    });

    const page1 = await service.list({ offset: 0, limit: 12, featuredRailSize: 10 } as never);

    // The rail itself gets the top 10, returned in the same response.
    expect(page1.featuredRail?.map((i) => i.id)).toEqual(Array.from({ length: 10 }, (_, i) => `boost${i}`));
    // Disjoint from what the rail already showed (boost0-9) — the grid's guaranteed slots start
    // right after it.
    expect(page1.items.map((i) => i.id).slice(0, 3)).toEqual(['boost10', 'boost11', 'boost12']);
  });

  it('round-robins the per-page featured cap by category, so one boost-heavy category cannot shut out another', async () => {
    // 13 boosted houses outrank (by boostRank) the account's one boosted apartment — a real
    // incident once boost adoption passed the cap: a flat boostRank-sorted slice gave every
    // guaranteed slot to whichever category had the most boost buyers, so a seller who boosted
    // the only listing in their category got none of the guaranteed slots despite paying the
    // same price as everyone else.
    const houses = Array.from({ length: 13 }, (_, i) =>
      row(`house${i}`, {
        category: 'house',
        boostRank: 0.99 - i * 0.01,
        boostedUntil: new Date(now + DAY),
      }),
    );
    const apartment = row('apartment0', {
      category: 'apartment',
      boostRank: 0.1,
      boostedUntil: new Date(now + DAY),
    });
    // allBoosted comes back boostRank-sorted (highest first), same as the real query's orderBy —
    // the apartment, with the lowest boostRank of all 14, sorts last.
    const boosted = [...houses, apartment];
    // Every house beyond the cap (now just 6 total across both pages, not 12) still shows up in
    // the recent pool, same as any other recent row would — still carries the Featured badge via
    // isBoosted (independent of the cap), just without a guaranteed slot.
    const recentOverflow = houses.slice(4);

    const { service } = makeMixService((args) => {
      const where = args.where as Record<string, unknown>;
      if ((where.boostRank as { not: null })?.not === null) return boosted;
      if ((where.createdAt as { gte?: Date })?.gte) return recentOverflow;
      return [];
    });

    const result = await service.list({ offset: 0, limit: 12 } as never);
    const ids = result.items.map((i) => i.id);

    // Round-robin gives the lone apartment the 2nd guaranteed slot (right after the single
    // highest-boostRank house), not the excluded-entirely position a flat sort would give it —
    // only the first 3 are guaranteed now, not all remaining houses.
    expect(ids.slice(0, 3)).toEqual(['house0', 'apartment0', 'house1']);
    // house5-12 (beyond the cap) still appear, via the recent pool, still carrying the badge.
    expect(result.items.find((i) => i.id === 'house12')?.isBoosted).toBe(true);
  });

  it('shows the round-robin overflow on page 2, not just page 1', async () => {
    const houses = Array.from({ length: 13 }, (_, i) =>
      row(`house${i}`, {
        category: 'house',
        boostRank: 0.99 - i * 0.01,
        boostedUntil: new Date(now + DAY),
      }),
    );
    const apartment = row('apartment0', {
      category: 'apartment',
      boostRank: 0.1,
      boostedUntil: new Date(now + DAY),
    });
    const boosted = [...houses, apartment];
    // Enough organic/overflow content to span both pages' non-featured fill, same reasoning as
    // the per-page cap test above.
    const recentOverflow = [...houses.slice(4), ...Array.from({ length: 10 }, (_, i) => row(`organic${i}`))];

    const { service } = makeMixService((args) => {
      const where = args.where as Record<string, unknown>;
      if ((where.boostRank as { not: null })?.not === null) return boosted;
      if ((where.createdAt as { gte?: Date })?.gte) return recentOverflow;
      return [];
    });

    const page1 = await service.list({ offset: 0, limit: 12 } as never);
    const page2 = await service.list({ offset: 12, limit: 12 } as never);

    // Page 1 gets its own 3 guaranteed slots, page 2 gets the next 3 — not page 1 claiming the
    // whole window's worth up front.
    expect(page1.items.map((i) => i.id).slice(0, 3)).toEqual(['house0', 'apartment0', 'house1']);
    expect(page2.items.map((i) => i.id).slice(0, 3)).toEqual(['house2', 'house3', 'house4']);
  });

  it('uses the plain single-query path, unchanged, once past the first 2 pages', async () => {
    const { service, findMany } = makeMixService(() => []);

    await service.list({ offset: 24, limit: 12 } as never);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0]).toMatchObject({ skip: 24, take: 12 });
  });

  // "Auto" (undefined or 'auto') is the only sort that gets the mix — a visitor who explicitly
  // asked for a different order, including plain "Newest first", wants exactly that, not a
  // reshuffled version of it, even on page 1.
  it.each(['newest', 'price_asc', 'price_desc', 'popular'] as const)(
    'bypasses the mix entirely on page 1 when sort=%s is explicitly chosen',
    async (sort) => {
      const { service, findMany } = makeMixService(() => []);

      await service.list({ offset: 0, limit: 12, sort } as never);

      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 12 });
    },
  );

  it('still applies the mix for sort=auto and no sort at all', async () => {
    for (const sort of [undefined, 'auto'] as const) {
      const { service, findMany } = makeMixService(() => []);
      await service.list({ offset: 0, limit: 4, ...(sort ? { sort } : {}) } as never);
      // 3 findMany calls (boosted, recent pool, older top-up) means the mix ran, not the plain path.
      expect(findMany).toHaveBeenCalledTimes(3);
    }
  });

  it('computes the Featured rail and the main grid from one request, disjoint by construction', async () => {
    // Same 2026-10-02 single-query merge this whole describe block's other tests exercise —
    // `featuredRailSize` used to require a second, separate `featuredOnly: true` request
    // (replaced entirely by this field; see docs/plans/homepage-category-mix-and-boost-page-cap.md,
    // Part 2).
    const houses = [
      row('h0', { category: 'house', boostRank: 0.9, boostedUntil: new Date(now + DAY) }),
      row('h1', { category: 'house', boostRank: 0.8, boostedUntil: new Date(now + DAY) }),
    ];
    const apartment = row('a0', { category: 'apartment', boostRank: 0.1, boostedUntil: new Date(now + DAY) });
    // allBoosted comes back boostRank-sorted (highest first), same as the real query's orderBy.
    const boosted = [...houses, apartment];
    const recent = Array.from({ length: 10 }, (_, i) => row(`organic${i}`, { category: 'house' }));

    const { service, findMany } = makeMixService((args) => {
      const where = args.where as Record<string, unknown>;
      if ((where.boostRank as { not: null })?.not === null) return boosted;
      if ((where.createdAt as { gte?: Date })?.gte) return recent;
      return [];
    });

    const result = await service.list({ offset: 0, limit: 12, featuredRailSize: 2 } as never);

    // One shared boosted-pool fetch serves both — not a separate request for the rail.
    expect(findMany).toHaveBeenCalledTimes(3); // allBoosted, recent pool, older top-up
    // Round-robin puts the apartment 2nd in the rail, ahead of the 2nd house, even though it
    // ranks lowest by boostRank — same fairness the grid's own cap gets.
    expect(result.featuredRail?.map((i) => i.id)).toEqual(['h0', 'a0']);
    // The grid's own per-page cap reserves past the rail's 2 — h1 (the only boosted listing left)
    // gets the grid's guaranteed slot, disjoint from the rail, not repeated from it.
    expect(result.items[0]?.id).toBe('h1');
    expect(result.items.map((i) => i.id)).not.toEqual(expect.arrayContaining(['h0', 'a0']));
  });

  it('omits featuredRail entirely (not even an empty array) when no rail was requested', async () => {
    const { service } = makeMixService(() => []);
    const result = await service.list({ offset: 0, limit: 12 } as never);
    expect(result.featuredRail).toBeUndefined();
  });
});

describe('ListingsService.listEngagement', () => {
  function makeEngagementService(opts: {
    favourites?: { user: { id: string; name: string | null; phone: string | null; email: string | null }; createdAt: Date }[];
    views?: { viewerKey: string; createdAt: Date }[];
    reveals?: { user: { id: string; name: string | null; phone: string | null; email: string | null }; createdAt: Date }[];
    users?: { id: string; name: string | null; phone: string | null; email: string | null }[];
    favouriteCount?: number;
    viewCount?: number;
    revealCount?: number;
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
      contactReveal: {
        findMany: jest.fn().mockResolvedValue(opts.reveals ?? []),
        count: jest.fn().mockResolvedValue(opts.revealCount ?? (opts.reveals ?? []).length),
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
      {
        getSettings: jest.fn().mockResolvedValue({
          propertyListingFee: 0,
          coworkingPgStorageListingFee: 0,
          furnitureInteriorsListingFee: 0,
        allowLivePublishWithPendingPayment: false,
        }),
      } as unknown as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
    { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
    { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined), revokeIfTakenDown: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService,
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

  it('merges contact-reveal rows alongside liked/viewed, sorted newest-first', async () => {
    const { service } = makeEngagementService({
      favourites: [{ user: user('u1'), createdAt: past(2) }],
      reveals: [{ user: user('u3'), createdAt: past(0.2) }],
    });

    const result = await service.listEngagement('listing1', 0, 25);
    expect(result.items.map((r) => [r.userId, r.action])).toEqual([
      ['u3', 'contact_revealed'],
      ['u1', 'liked'],
    ]);
    expect(result.total).toBe(2);
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
    // fromBroker: 'no' rather than omitted — now required (see sellerType.ts's own doc comment),
    // and 'no' (vs. 'yes') avoids incidentally making the brokerage-fee fields visible too.
    // furnished: 'unfurnished' for the same reason (categoryFields.ts) — 'unfurnished' rather than
    // 'furnished' avoids incidentally making the furnishing-inventory fields visible too.
    const residentialBasics = {
      floor: '2',
      totalFloors: '4',
      entranceFacing: 'east',
      fromBroker: 'no',
      furnished: 'unfurnished',
    };
    const validAttributes = {
      bedrooms: '2',
      bathrooms: '2',
      carpetAreaSqft: '950',
      ...residentialBasics,
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

    /** The bug this pins: attributes came in as strings from every client, nothing normalised
     * them, and the bedroom filter compares against a number — so every BHK filter and every
     * /{n}bhk facet page matched nothing at all. */
    it('stores number-typed attributes as numbers, leaving everything else untouched', () => {
      const { service } = makeService();

      const normalized = (service as any).normalizeAttributes('apartment', {
        ...validAttributes,
        bedrooms: '02',
      }) as Record<string, unknown>;

      expect(normalized.bedrooms).toBe(2);
      expect(normalized.carpetAreaSqft).toBe(950);
      expect(normalized.closedParkingCount).toBe(0);
      // Selects, multi-selects and yes/no stay exactly as they were — only `type: "number"`
      // fields are touched.
      expect(normalized.gatedCommunity).toBe('yes');
      expect(normalized.preferredTenantTypes).toEqual(['family', 'company']);
    });

    it('leaves a blank or unparseable number alone rather than inventing a value', () => {
      const { service } = makeService();

      const normalized = (service as any).normalizeAttributes('apartment', {
        bedrooms: '',
        bathrooms: '   ',
        carpetAreaSqft: 'about 900',
        balconyCount: 3,
      }) as Record<string, unknown>;

      // "" is how "left blank" is stored, and must not become 0.
      expect(normalized.bedrooms).toBe('');
      expect(normalized.bathrooms).toBe('   ');
      expect(normalized.carpetAreaSqft).toBe('about 900');
      // Already a number: idempotent, which is what makes re-saving a listing safe.
      expect(normalized.balconyCount).toBe(3);
    });

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
          ...residentialBasics,
          bedrooms: '2',
          bathrooms: '2',
          carpetAreaSqft: '950',
          maintenanceFeeApplicable: 'no',
          monthlyMaintenanceFee: '2500',
        }),
        // The generic dependency check fires first and names the field by its own config label —
        // this test was written against an older, field-specific message that the config's
        // `dependsOn` support replaced, and had been failing since.
      ).toThrow('Maintenance fee (₹) is not applicable');
    });

    it('accepts legacy sqft as the area required by older listings', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'sell', {
          ...residentialBasics,
          bedrooms: 2,
          bathrooms: 2,
          sqft: 950,
        }),
      ).not.toThrow();
    });

    // On a sale the poster first picks a fixed ₹ amount or a % of the sale price, and only that
    // type's amount field applies. Rent/lease brokerage is a ₹ amount with no type question.
    it.each([
      ['house', 'sell', { brokerageFeeType: 'fixed', brokerageFee: '200000' }],
      ['house', 'sell', { brokerageFeeType: 'percent', brokerageCommissionPercent: '1.5' }],
      ['apartment', 'rent', { brokerageFee: '5000' }],
      ['apartment', 'lease', { brokerageFee: '5000' }],
    ] as const)('accepts a %s %s listing with brokerage %j', (category, transactionType, brokerage) => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes(category, transactionType, {
          bedrooms: '2',
          bathrooms: '2',
          carpetAreaSqft: '950',
          ...residentialBasics,
          fromBroker: 'yes',
          brokerageFeeApplicable: 'yes',
          ...brokerage,
        }),
      ).not.toThrow();
    });

    const brokered = {
      bedrooms: '2',
      bathrooms: '2',
      carpetAreaSqft: '950',
      ...residentialBasics,
      fromBroker: 'yes',
      brokerageFeeApplicable: 'yes',
    };

    it('requires the brokerage fee type once a brokerage fee applies', () => {
      const { service } = makeService();
      expect(() => (service as any).assertValidAttributes('house', 'sell', brokered)).toThrow(
        'Brokerage fee type is required',
      );
    });

    it('requires the amount of the chosen brokerage type', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'sell', { ...brokered, brokerageFeeType: 'fixed' }),
      ).toThrow('Brokerage Fee (₹) is required');
      expect(() =>
        (service as any).assertValidAttributes('house', 'sell', { ...brokered, brokerageFeeType: 'percent' }),
      ).toThrow('Brokerage Fee (%) is required');
      expect(() => (service as any).assertValidAttributes('apartment', 'rent', brokered)).toThrow(
        'Brokerage Fee (₹) is required',
      );
    });

    it('rejects an amount of the brokerage type that was not chosen', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'sell', {
          ...brokered,
          brokerageFeeType: 'percent',
          brokerageCommissionPercent: '2',
          brokerageFee: '5000',
        }),
      ).toThrow('Brokerage Fee (₹) is not applicable');
    });

    it('rejects a percentage on a rental — rent brokerage is a ₹ amount only', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('apartment', 'rent', {
          ...brokered,
          brokerageFee: '5000',
          brokerageCommissionPercent: '8.33',
        }),
      ).toThrow('Brokerage Fee (%) is not applicable');
    });

    it.each(['0', '0.2', '5.5', '100', '1.125', 'two'])('rejects a brokerage percentage of %s', (percent) => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'sell', {
          ...brokered,
          brokerageFeeType: 'percent',
          brokerageCommissionPercent: percent,
        }),
      ).toThrow('Brokerage Fee (%) must be between 0.25 and 5, up to 2 decimal places');
    });

    it('rejects a fixed brokerage fee that is not a whole rupee amount, or under ₹500', () => {
      const { service } = makeService();
      for (const fee of ['5000.5', '499']) {
        expect(() =>
          (service as any).assertValidAttributes('house', 'sell', {
            ...brokered,
            brokerageFeeType: 'fixed',
            brokerageFee: fee,
          }),
        ).toThrow('Brokerage Fee (₹) must be a whole number of at least 500');
      }
    });

    it('infers the brokerage type for a sale payload from before the type question', () => {
      expect(
        normalizeBrokerageAttributes('sell', { brokerageFeeApplicable: 'yes', brokerageFee: '5000' }),
      ).toMatchObject({ brokerageFeeType: 'fixed' });
      expect(
        normalizeBrokerageAttributes('sell', { brokerageFeeApplicable: 'yes', brokerageCommissionPercent: 2 }),
      ).toMatchObject({ brokerageFeeType: 'percent' });
      const chosen = { brokerageFeeApplicable: 'yes', brokerageFeeType: 'percent', brokerageFee: '5000' };
      expect(normalizeBrokerageAttributes('sell', chosen)).toBe(chosen);
      const none = { brokerageFeeApplicable: 'no' };
      expect(normalizeBrokerageAttributes('sell', none)).toBe(none);
    });

    it('drops the brokerage type from a rent/lease payload (an old app build, or a stored listing)', () => {
      expect(
        normalizeBrokerageAttributes('rent', {
          brokerageFeeApplicable: 'yes',
          brokerageFeeType: 'fixed',
          brokerageFee: '5000',
        }),
      ).toEqual({ brokerageFeeApplicable: 'yes', brokerageFee: '5000' });
    });

    describe('brokerage against the price', () => {
      const saleFixed = { brokerageFeeApplicable: 'yes', brokerageFeeType: 'fixed' };

      it('caps a sale at 5% of the price and floors it at ₹1,000', () => {
        expect(brokerageFeeIssue('sell', 5_000_000, { ...saleFixed, brokerageFee: '250000' })).toBeNull();
        expect(brokerageFeeIssue('sell', 5_000_000, { ...saleFixed, brokerageFee: '250001' })).toBe(
          'Brokerage Fee (₹) can be at most ₹2,50,000 (5% of the price)',
        );
        expect(brokerageFeeIssue('sell', 5_000_000, { ...saleFixed, brokerageFee: 999 })).toBe(
          'Brokerage Fee (₹) must be at least ₹1,000 on a sale',
        );
      });

      it('caps rent and lease at 2 months of the monthly price', () => {
        const rent = { brokerageFeeApplicable: 'yes', brokerageFee: '47000' };
        expect(brokerageFeeIssue('rent', 23_500, rent)).toBeNull();
        expect(brokerageFeeIssue('lease', 23_500, { ...rent, brokerageFee: 47_001 })).toBe(
          "Brokerage Fee (₹) can be at most ₹47,000 (2 months' rent)",
        );
      });

      it('leaves a % to the field range, and skips the ceiling without a price', () => {
        expect(
          brokerageFeeIssue('sell', 650_000, {
            brokerageFeeApplicable: 'yes',
            brokerageFeeType: 'percent',
            brokerageCommissionPercent: '5',
          }),
        ).toBeNull();
        expect(brokerageFeeIssue('rent', 0, { brokerageFeeApplicable: 'yes', brokerageFee: '900000' })).toBeNull();
      });

      it('shows what a % comes to, and the most a ₹ amount may be', () => {
        expect(
          brokerageFeeNote('sell', 6_500_000, {
            brokerageFeeApplicable: 'yes',
            brokerageFeeType: 'percent',
            brokerageCommissionPercent: '2',
          }),
        ).toEqual({ key: 'brokerageCommissionPercent', text: '≈ ₹1,30,000 of ₹65,00,000' });
        expect(brokerageFeeNote('rent', 23_500, { brokerageFeeApplicable: 'yes' })).toEqual({
          key: 'brokerageFee',
          text: "Up to ₹47,000 (2 months' rent)",
        });
        expect(brokerageFeeNote('sell', 6_500_000, { brokerageFeeApplicable: 'yes' })).toBeNull();
      });
    });

    it('accepts a plot sale with either brokerage type', () => {
      const { service } = makeService();
      const plot = { plotAreaSqft: '1200', fromBroker: 'yes', brokerageFeeApplicable: 'yes' };
      expect(() =>
        (service as any).assertValidAttributes('plot', 'sell', {
          ...plot,
          brokerageFeeType: 'percent',
          brokerageCommissionPercent: '2',
        }),
      ).not.toThrow();
      expect(() =>
        (service as any).assertValidAttributes('plot', 'sell', {
          ...plot,
          brokerageFeeType: 'fixed',
          brokerageFee: '50000',
        }),
      ).not.toThrow();
      expect(() => (service as any).assertValidAttributes('plot', 'sell', plot)).toThrow(
        'Brokerage fee type is required',
      );
    });

    it('accepts commercial brokerage: a ₹ amount on rent, either type on a sale', () => {
      const { service } = makeService();
      const commercial = { sqft: '1200', purpose: 'office', fromBroker: 'yes', brokerageFeeApplicable: 'yes' };
      expect(() =>
        (service as any).assertValidAttributes('commercial', 'rent', {
          ...commercial,
          brokerageFee: '100000',
        }),
      ).not.toThrow();
      expect(() =>
        (service as any).assertValidAttributes('commercial', 'sell', {
          ...commercial,
          brokerageFeeType: 'percent',
          brokerageCommissionPercent: '2',
        }),
      ).not.toThrow();
      expect(() =>
        (service as any).assertValidAttributes('commercial', 'sell', {
          ...commercial,
          brokerageFeeType: 'fixed',
          brokerageFee: '100000',
        }),
      ).not.toThrow();
    });

    it('rejects furnishing inventory when the residence is not furnished', () => {
      const { service } = makeService();
      expect(() =>
        (service as any).assertValidAttributes('house', 'rent', {
          ...residentialBasics,
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
          ...residentialBasics,
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
          ...residentialBasics,
          bedrooms: 2,
          bathrooms: 2,
          carpetAreaSqft: 950,
          furnished: 'furnished',
          cctv: 'sometimes',
        }),
      ).toThrow('Invalid cctv');

      expect(() =>
        (service as any).assertValidAttributes('apartment', 'rent', {
          ...residentialBasics,
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
          ...residentialBasics,
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
        {
          getSettings: jest.fn().mockResolvedValue({
            propertyListingFee: 0,
            coworkingPgStorageListingFee: 0,
            furnitureInteriorsListingFee: 0,
          allowLivePublishWithPendingPayment: false,
          }),
        } as unknown as PlatformFeeSettingsService,
        { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
      { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
      { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined), revokeIfTakenDown: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService,
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

    it.each([
      [{ agentProUntil: null, sellerType: 'agent', agencyName: 'Sai Realty' }, 'agent', 'Sai Realty'],
      [{ agentProUntil: null, sellerType: 'owner', agencyName: 'Stale Realty' }, 'owner', null],
      [{ agentProUntil: null }, null, null],
    ])('labels the poster from User.sellerType (%o)', async (owner, postedBy, postedByAgency) => {
      const { service } = setup(listingRow(), listingRow({ owner }));

      const dto = await service.renew('listing1', 'owner1');

      expect(dto.postedBy).toBe(postedBy);
      expect(dto.postedByAgency).toBe(postedByAgency);
    });

    it("prefers the listing's own fromBroker answer over the account's, hiding the agency", async () => {
      const { service } = setup(
        listingRow(),
        listingRow({
          attributes: { fromBroker: 'no' },
          owner: { agentProUntil: null, sellerType: 'agent', agencyName: 'Sai Realty' },
        }),
      );

      const dto = await service.renew('listing1', 'owner1');

      expect(dto.postedBy).toBe('owner');
      expect(dto.postedByAgency).toBeNull();
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

    it('does not email when the listing is not currently boosted (push still attempted)', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 2,
        title: 'An unboosted listing',
        ownerId: 'owner1',
        boostedUntil: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'owner@example.com',
        phone: null,
        name: 'Buyer',
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

    it('logs the push as a liked notification once a device actually received it — regardless of boost', async () => {
      const { service, prisma, pushService } = makeService();
      pushService.notifyListingFavourite.mockResolvedValue(true);
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 2,
        title: 'An unboosted listing',
        ownerId: 'owner1',
        boostedUntil: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: null,
        phone: null,
      });

      await service.toggleFavourite('listing1', 'liker1');
      await new Promise((r) => setImmediate(r));

      // False positive on this model, same as elsewhere in this codebase's tests — plain jest
      // mocks carry no real `this`-binding risk.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
        data: { listingId: 'listing1', kind: 'liked', channel: 'push' },
      });
    });

    it('does not log a push notification when the recipient had no registered device', async () => {
      const { service, prisma, pushService } = makeService();
      pushService.notifyListingFavourite.mockResolvedValue(false);
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 2,
        title: 'An unboosted listing',
        ownerId: 'owner1',
        boostedUntil: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: null,
        phone: null,
      });

      await service.toggleFavourite('listing1', 'liker1');
      await new Promise((r) => setImmediate(r));

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.listingNotificationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavourite with an explicit state, and importFavourites', () => {
    it('leaves an already-saved listing saved when asked to save it', async () => {
      const { service, prisma } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue({ id: 'fav1' });
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ likeCount: 4 });

      const result = await service.toggleFavourite('listing1', 'user1', true);

      expect(result).toEqual({ favourited: true, likeCount: 4 });
      expect(prisma.favourite.delete).not.toHaveBeenCalled();
      expect(prisma.favourite.create).not.toHaveBeenCalled();
    });

    it('still flips the favourite when no state is given', async () => {
      const { service, prisma } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue({ id: 'fav1' });
      (prisma.listing.update as jest.Mock).mockResolvedValue({ likeCount: 3 });

      const result = await service.toggleFavourite('listing1', 'user1');

      expect(result).toEqual({ favourited: false, likeCount: 3 });
      expect(prisma.favourite.delete).toHaveBeenCalledWith({ where: { id: 'fav1' } });
    });

    it('throws NotFound for a missing listing when the state already matches', async () => {
      const { service, prisma } = makeService();
      (prisma.favourite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.toggleFavourite('gone', 'user1', false)).rejects.toThrow(NotFoundException);
    });

    it('imports device saves, skipping the user\'s own and missing listings, without un-saving', async () => {
      const { service, prisma } = makeService();
      (prisma.listing.findMany as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      (prisma.favourite.findUnique as jest.Mock).mockImplementation(
        ({ where }: { where: { listingId_userId: { listingId: string } } }) =>
          Promise.resolve(where.listingId_userId.listingId === 'a' ? { id: 'favA' } : null),
      );
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ likeCount: 1 });
      (prisma.favourite.create as jest.Mock).mockResolvedValue({});
      (prisma.listing.update as jest.Mock).mockResolvedValue({
        likeCount: 1,
        title: 'B',
        ownerId: 'owner1',
        boostedUntil: null,
      });

      const result = await service.importFavourites('user1', ['a', 'b', 'b', 'gone']);

      expect(result).toEqual({ saved: 2 });
      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['a', 'b', 'gone'] }, ownerId: { not: 'user1' } },
        }),
      );
      expect(prisma.favourite.delete).not.toHaveBeenCalled();
      expect(prisma.favourite.create).toHaveBeenCalledTimes(1);
      expect(prisma.favourite.create).toHaveBeenCalledWith({ data: { listingId: 'b', userId: 'user1' } });
    });
  });

  describe('recordInterest', () => {
    function stubListing(overrides: Record<string, unknown> = {}) {
      return {
        id: 'listing1',
        title: 'Nice flat',
        ownerId: 'owner1',
        instantAlertsUntil: future(48),
        publishState: 'live',
        ...overrides,
      };
    }

    it('upserts interest and notifies on authenticated view when Instant Alerts is active', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(stubListing());
      (prisma.listingInterest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.listingInterest.upsert as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ email: 'owner@example.com', phone: null })
        .mockResolvedValueOnce({ name: 'Riya' });
      (notificationsService.notifyListingInterest as jest.Mock).mockResolvedValue('email');
      (prisma.listingNotificationLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.recordInterest('listing1', 'buyer1', 'view');
      expect(result).toEqual({ interested: true, notified: true });
      expect(prisma.listingInterest.upsert).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(notificationsService.notifyListingInterest).toHaveBeenCalled();
    });

    it('does not send interest notify on message mode (message path covers notify)', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(stubListing());
      (prisma.listingInterest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.listingInterest.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.recordInterest('listing1', 'buyer1', 'message');
      expect(result).toEqual({ interested: true, notified: false });
      await new Promise((r) => setImmediate(r));
      expect(notificationsService.notifyListingInterest).not.toHaveBeenCalled();
    });

    it('skips view re-notify inside the 24h window', async () => {
      const { service, prisma, notificationsService } = makeService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(stubListing());
      (prisma.listingInterest.findUnique as jest.Mock).mockResolvedValue({
        lastNotifiedAt: new Date(),
      });
      (prisma.listingInterest.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.recordInterest('listing1', 'buyer1', 'view');
      expect(result.notified).toBe(false);
      await new Promise((r) => setImmediate(r));
      expect(notificationsService.notifyListingInterest).not.toHaveBeenCalled();
    });

    it('rejects the owner registering interest in their own listing', async () => {
      const { service, prisma } = makeService();
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(stubListing());
      await expect(service.recordInterest('listing1', 'owner1', 'view')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('logs the push as a listing_interest notification once a device actually received it', async () => {
      const { service, prisma, pushService } = makeService();
      pushService.notifyListingInterest.mockResolvedValue(true);
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(stubListing());
      (prisma.listingInterest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.listingInterest.upsert as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ email: null, phone: null })
        .mockResolvedValueOnce({ name: 'Riya' });

      await service.recordInterest('listing1', 'buyer1', 'view');
      await new Promise((r) => setImmediate(r));

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith({
        data: {
          listingId: 'listing1',
          kind: 'listing_interest',
          channel: 'push',
        },
      });
    });

    it('does not log a push notification when the recipient had no registered device', async () => {
      const { service, prisma, pushService } = makeService();
      pushService.notifyListingInterest.mockResolvedValue(false);
      (prisma.listing.findUnique as jest.Mock).mockResolvedValue(stubListing());
      (prisma.listingInterest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.listingInterest.upsert as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ email: null, phone: null })
        .mockResolvedValueOnce({ name: 'Riya' });

      await service.recordInterest('listing1', 'buyer1', 'view');
      await new Promise((r) => setImmediate(r));

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.listingNotificationLog.create).not.toHaveBeenCalled();
    });
  });
});

describe('ListingsService.recordView', () => {
  it('increments both viewCount and uniqueViewerCount for a never-seen-before viewerKey', async () => {
    const { service, prisma } = makeService();
    (prisma.listingView.count as jest.Mock).mockResolvedValue(0);
    (prisma.listing.update as jest.Mock).mockResolvedValue({ viewCount: 1 });

    await service.recordView('listing1', 'user:buyer1');

    expect(prisma.listingView.create).toHaveBeenCalledWith({
      data: { listingId: 'listing1', viewerKey: 'user:buyer1' },
    });
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing1' },
      data: { viewCount: { increment: 1 }, uniqueViewerCount: { increment: 1 } },
      select: { viewCount: true },
    });
  });

  it('increments only viewCount, not uniqueViewerCount, on a repeat view from the same viewerKey', async () => {
    const { service, prisma } = makeService();
    (prisma.listingView.count as jest.Mock).mockResolvedValue(2);
    (prisma.listing.update as jest.Mock).mockResolvedValue({ viewCount: 3 });

    await service.recordView('listing1', 'user:buyer1');

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing1' },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
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

  it('filters by title (partial, case-insensitive) when a search term is given', async () => {
    const { where } = await callWith({ search: 'gents pg' });
    expect(where).toMatchObject({ title: { contains: 'gents pg', mode: 'insensitive' } });
  });

  it('omits the title filter from the where clause when no search term is given', async () => {
    const { where } = await callWith({});
    expect(where).not.toHaveProperty('title');
  });

  it('filters by owner (ownerId) when a userId is given', async () => {
    const { where } = await callWith({ userId: 'user1' });
    expect(where).toMatchObject({ ownerId: 'user1' });
  });

  it('sorts by organic view count (the denormalized uniqueViewerCount column)', async () => {
    expect((await callWith({ sort: 'organicViewCount_asc' })).orderBy).toEqual([
      { uniqueViewerCount: 'asc' },
      { id: 'asc' },
    ]);
    expect((await callWith({ sort: 'organicViewCount_desc' })).orderBy).toEqual([
      { uniqueViewerCount: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('sorts by owner name, nulls last', async () => {
    expect((await callWith({ sort: 'owner_asc' })).orderBy).toEqual([
      { owner: { name: { sort: 'asc', nulls: 'last' } } },
      { id: 'asc' },
    ]);
  });

  it('sorts by boosted-until, nulls last so never-boosted listings sort to the end', async () => {
    expect((await callWith({ sort: 'boosted_desc' })).orderBy).toEqual([
      { boostedUntil: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });
});

describe('ListingsService.listPerformanceForAdmin', () => {
  // makeService's base prisma mock has no `listingView.groupBy` or `message` model (no other
  // method under test needs them) — added here rather than in makeService itself.
  function makePerfService() {
    const base = makeService();
    const prisma = base.prisma as unknown as {
      listing: { findMany: jest.Mock; count: jest.Mock };
      listingView: { groupBy: jest.Mock };
      conversation: { findMany: jest.Mock };
      message: { findMany: jest.Mock };
    };
    prisma.listingView.groupBy = jest.fn().mockResolvedValue([]);
    prisma.message = { findMany: jest.fn().mockResolvedValue([]) };
    return base;
  }

  function stubRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'listing1',
      title: 'Nice flat',
      slug: 'nice-flat',
      city: { name: 'Bengaluru' },
      area: { name: 'Koramangala' },
      category: 'apartment',
      transactionType: 'rent',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      viewCount: 10,
      uniqueViewerCount: 8,
      likeCount: 2,
      boostedUntil: null,
      _count: { conversations: 0, contactReveals: 0 },
      ...overrides,
    };
  }

  it('splits views into logged-in and anonymous from two independent ListingView groupBys, never negative', async () => {
    const { service, prisma } = makePerfService();
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([stubRow()]);
    (prisma.listing.count as jest.Mock).mockResolvedValue(1);
    (prisma.listingView.groupBy as jest.Mock)
      .mockResolvedValueOnce([{ listingId: 'listing1', _count: { _all: 10 } }]) // total
      .mockResolvedValueOnce([{ listingId: 'listing1', _count: { _all: 4 } }]); // logged-in
    (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.listPerformanceForAdmin({ limit: 25 } as never);

    expect(result.items[0].loggedInViews).toBe(4);
    expect(result.items[0].anonymousViews).toBe(6);
  });

  it('aggregates total messages, unique senders, and owner-replied threads from a small conversation+message fixture', async () => {
    const { service, prisma } = makePerfService();
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([stubRow({ _count: { conversations: 2, contactReveals: 0 } })]);
    (prisma.listing.count as jest.Mock).mockResolvedValue(1);
    // posterId is the listing owner (see Conversation.posterId's schema comment) — conv1's owner
    // replies, conv2's doesn't, so only conv1 should count toward repliedThreads.
    (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
      { id: 'conv1', listingId: 'listing1', posterId: 'owner1' },
      { id: 'conv2', listingId: 'listing1', posterId: 'owner1' },
    ]);
    (prisma.message.findMany as jest.Mock).mockResolvedValue([
      { conversationId: 'conv1', senderId: 'inquirerA' },
      { conversationId: 'conv1', senderId: 'owner1' },
      { conversationId: 'conv2', senderId: 'inquirerB' },
    ]);

    const result = await service.listPerformanceForAdmin({ limit: 25 } as never);
    const row = result.items[0];
    expect(row.totalMessages).toBe(3);
    expect(row.uniqueMessageSenders).toBe(3);
    expect(row.repliedThreads).toBe(1);
    expect(row.enquiryCount).toBe(2);
  });

  it('renders zero enquiries as an empty message/reply shape, not misleading zeros', async () => {
    const { service, prisma } = makePerfService();
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([stubRow()]);
    (prisma.listing.count as jest.Mock).mockResolvedValue(1);
    (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.listPerformanceForAdmin({ limit: 25 } as never);
    const row = result.items[0];
    expect(row.enquiryCount).toBe(0);
    expect(row.totalMessages).toBe(0);
    expect(row.uniqueMessageSenders).toBe(0);
    expect(row.repliedThreads).toBe(0);
  });

  it('applies cityId, areaId, and the createdFrom/createdTo range to the where clause', async () => {
    const { service, prisma } = makePerfService();
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.listing.count as jest.Mock).mockResolvedValue(0);
    (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

    await service.listPerformanceForAdmin({
      cityId: 'city1',
      areaId: 'area1',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      limit: 25,
    } as never);

    const where = (prisma.listing.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where).toMatchObject({
      cityId: 'city1',
      areaId: 'area1',
      createdAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
    });
  });

  it('omits cityId/areaId/createdAt from the where clause when none are given', async () => {
    const { service, prisma } = makePerfService();
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.listing.count as jest.Mock).mockResolvedValue(0);
    (prisma.conversation.findMany as jest.Mock).mockResolvedValue([]);

    await service.listPerformanceForAdmin({ limit: 25 } as never);

    const where = (prisma.listing.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where).not.toHaveProperty('cityId');
    expect(where).not.toHaveProperty('areaId');
    expect(where).not.toHaveProperty('createdAt');
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
      attributes: { sharingType: ['single'] },
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

describe('ListingsService.update — brokerage against the price', () => {
  // The 99% brokerage on a ₹6.5 lakh house that prompted these limits.
  const stored = {
    id: 'l1',
    ownerId: 'owner1',
    category: 'house',
    transactionType: 'sell',
    price: 650_000,
    priceUnit: null,
    priceQualifier: '',
    title: 'House for sale',
    specs: [],
    description: null,
    attributes: {
      bedrooms: 2,
      bathrooms: 1,
      carpetAreaSqft: 900,
      floor: 'ground',
      totalFloors: 1,
      entranceFacing: 'east',
      fromBroker: 'yes',
      brokerageFeeApplicable: 'yes',
      brokerageFeeType: 'fixed',
      brokerageFee: 500_000,
    },
    status: 'active',
    moderationState: 'approved',
  };

  function serviceWith(row: Record<string, unknown>) {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue(row);
    (prisma.listing.update as jest.Mock).mockResolvedValue({});
    return { service, prisma };
  }

  it('lets an unrelated edit through on a fee stored before the limits', async () => {
    const { service, prisma } = serviceWith(stored);
    await service.update('l1', 'owner1', { title: 'House for sale, 2 BHK' } as never).catch(() => undefined);
    expect(prisma.listing.update).toHaveBeenCalled();
  });

  it('re-checks the stored fee when the price changes', async () => {
    const { service, prisma } = serviceWith(stored);
    await expect(service.update('l1', 'owner1', { price: 700_000 } as never)).rejects.toThrow(
      'Brokerage Fee (₹) can be at most ₹35,000 (5% of the price)',
    );
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it('checks a fee sent in the edit against the stored price', async () => {
    const { service } = serviceWith(stored);
    await expect(
      service.update('l1', 'owner1', { attributes: { ...stored.attributes, brokerageFee: '40000' } } as never),
    ).rejects.toThrow('Brokerage Fee (₹) can be at most ₹32,500 (5% of the price)');
  });
});

describe('ListingsService totalPrice — per-unit listings', () => {
  type TotalPriceFn = (listing: Record<string, unknown>) => unknown;
  const totalPriceOf = (listing: Record<string, unknown>) =>
    (makeService().service as unknown as { listingTotalPrice: TotalPriceFn }).listingTotalPrice(listing);

  it('multiplies a per sq ft plot price out to the stored total and its area', () => {
    expect(
      totalPriceOf({ category: 'plot', price: 60_00_000, priceUnit: 'sqft', attributes: { plotAreaSqft: 1200 } }),
    ).toEqual({ price: '₹60,00,000', priceInWords: '₹60 Lakh', area: '1,200 sq ft' });
  });

  it('is null for a whole price, price on request, or a per-unit price with no area', () => {
    expect(totalPriceOf({ category: 'plot', price: 60_00_000, priceUnit: null, attributes: { plotAreaSqft: 1200 } })).toBeNull();
    expect(totalPriceOf({ category: 'plot', price: 0, priceUnit: 'sqft', attributes: { plotAreaSqft: 1200 } })).toBeNull();
    expect(totalPriceOf({ category: 'plot', price: 60_00_000, priceUnit: 'sqft', attributes: {} })).toBeNull();
  });
});

describe('ListingsService.updateAsAdmin — the admin content-override endpoint', () => {
  it('edits a listing regardless of who owns it, with no ownership check at all', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({
      id: 'l1',
      ownerId: 'someone-else-entirely',
      category: 'pg',
      transactionType: 'rent',
      price: 5000,
      priceQualifier: '/month',
      title: 'Old title',
      specs: [],
      description: null,
      attributes: {},
      status: 'active',
      moderationState: 'approved',
    });
    (prisma.listing.update as jest.Mock).mockResolvedValue({});

    // Would throw ForbiddenException if this checked ownership the way update() does —
    // completing without one confirms the admin path genuinely has no such check.
    await service.updateAsAdmin('l1', { title: 'Fixed by support' } as never, 'admin1').catch(() => undefined);

    expect(prisma.listingEditLog.create).toHaveBeenCalledWith({
      data: {
        listingId: 'l1',
        actorType: 'admin',
        actorId: 'admin1',
        action: 'updated',
        changes: { title: { before: 'Old title', after: 'Fixed by support' } },
      },
    });
  });
});

describe('ListingsService.flag/approve/setStatusAsAdmin — attribute the change to the admin', () => {
  it('flag() logs the moderationState before/after and the admin as actor, and revokes any unused referral credit', async () => {
    const { service, prisma, referralsService } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ moderationState: 'approved' });
    (prisma.listing.update as jest.Mock).mockResolvedValue({ ownerId: 'owner1' });

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
    expect(referralsService.revokeIfTakenDown).toHaveBeenCalledWith('owner1', expect.any(String));
  });

  it('approve() logs the moderationState before/after and the admin as actor, and checks for a referral reward', async () => {
    const { service, prisma, referralsService } = makeService();
    (prisma.listing.findUnique as jest.Mock).mockResolvedValue({ moderationState: 'flagged' });
    (prisma.listing.update as jest.Mock).mockResolvedValue({ ownerId: 'owner1' });

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
    expect(referralsService.recordFirstApprovedAdIfReferred).toHaveBeenCalledWith('owner1');
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

describe('ListingsService.getSellerAttention', () => {
  it('returns pending checkout, active, and renew-window counts', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);

    (prisma.listing.findFirst as jest.Mock) = jest.fn();

    await expect(service.getSellerAttention('user-1')).resolves.toEqual({
      pendingCheckoutCount: 2,
      pendingCheckoutListingId: null,
      activeListingCount: 5,
      expiringWithinDaysCount: 1,
    });

    expect(prisma.listing.count).toHaveBeenCalledTimes(3);
    expect(prisma.listing.findFirst).not.toHaveBeenCalled();
    expect(prisma.listing.count).toHaveBeenNthCalledWith(1, {
      where: { ownerId: 'user-1', publishState: 'pending_checkout' },
    });
    expect(prisma.listing.count).toHaveBeenNthCalledWith(2, {
      where: { ownerId: 'user-1', status: 'active' },
    });
  });

  it('returns pendingCheckoutListingId when exactly one pending listing', async () => {
    const { service, prisma } = makeService();
    (prisma.listing.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    (prisma.listing.findFirst as jest.Mock).mockResolvedValue({ id: 'listing-pending' });

    await expect(service.getSellerAttention('user-1')).resolves.toEqual({
      pendingCheckoutCount: 1,
      pendingCheckoutListingId: 'listing-pending',
      activeListingCount: 1,
      expiringWithinDaysCount: 0,
    });
  });
});

describe('ListingsService.assertOwnerPhoneVerified', () => {
  const setup = (owner: unknown) => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(owner);
    return service;
  };

  it('passes for an owner whose phone is verified', async () => {
    const service = setup({ phone: '+919999999999', phoneVerifiedAt: new Date() });
    await expect(service.assertOwnerPhoneVerified('u1')).resolves.toBeUndefined();
  });

  it.each([
    ['no phone at all (Google/Apple signup)', { phone: null, phoneVerifiedAt: null }],
    ['a phone that was never verified', { phone: '+919999999999', phoneVerifiedAt: null }],
    ['no such user', null],
  ])('rejects with a machine-readable code for %s', async (_label, owner) => {
    const service = setup(owner);
    await expect(service.assertOwnerPhoneVerified('u1')).rejects.toMatchObject({
      response: { code: 'PHONE_VERIFICATION_REQUIRED' },
    });
  });
});

describe('resolveDeclaredSellerType', () => {
  it('fills a blank fromBroker from the wizard answer and saves it to the profile', () => {
    const r = resolveDeclaredSellerType('apartment', {}, 'agent', null);
    expect(r.attributes.fromBroker).toBe('yes');
    expect(r.saveToProfile).toBe('agent');
  });

  it("fills a blank fromBroker from the profile without re-saving it", () => {
    const r = resolveDeclaredSellerType('house', {}, undefined, 'owner');
    expect(r.attributes.fromBroker).toBe('no');
    expect(r.saveToProfile).toBeNull();
  });

  it("doesn't save a bare fromBroker to the profile — older mobile builds preset it to 'no'", () => {
    const r = resolveDeclaredSellerType('plot', { fromBroker: 'no' }, undefined, null);
    expect(r.attributes.fromBroker).toBe('no');
    expect(r.saveToProfile).toBeNull();
  });

  it('keeps an answered fromBroker and saves the wizard answer derived from it', () => {
    const r = resolveDeclaredSellerType('plot', { fromBroker: 'yes' }, 'agent', null);
    expect(r.attributes.fromBroker).toBe('yes');
    expect(r.saveToProfile).toBe('agent');
  });

  it("never lets one listing's answer overwrite an answered profile", () => {
    const r = resolveDeclaredSellerType('apartment', { fromBroker: 'no' }, undefined, 'agent');
    expect(r.attributes.fromBroker).toBe('no');
    expect(r.saveToProfile).toBeNull();
  });

  it('leaves categories without a fromBroker field untouched', () => {
    const r = resolveDeclaredSellerType('pg', {}, 'owner', null);
    expect(r.attributes).not.toHaveProperty('fromBroker');
    expect(r.saveToProfile).toBe('owner');
  });
});

/**
 * linkListingViewsToUser used to be a pure rename: a visitor who browsed anonymously and only
 * logged in afterward meant those owners never heard about the visit, since recordInterest only
 * ran for views that happened *after* a session existed. This is the fix: retroactively run
 * recordInterest for every distinct listing viewed anonymously in a recent window, while the
 * rename itself (needed for correct analytics attribution) stays unbounded.
 */
describe('ListingsService.linkListingViewsToUser', () => {
  it('retroactively notifies owners for distinct listings viewed anonymously within the window', async () => {
    const { service, prisma } = makeService();
    (prisma.listingView.findMany as jest.Mock).mockResolvedValue([
      { listingId: 'listing1' },
      { listingId: 'listing2' },
    ]);
    const recordInterest = jest.spyOn(service, 'recordInterest').mockResolvedValue({ interested: true, notified: true });

    await service.linkListingViewsToUser('device-key', 'user1');

    expect(prisma.listingView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ viewerKey: 'anon:device-key' }),
        distinct: ['listingId'],
      }),
    );
    expect(recordInterest).toHaveBeenCalledTimes(2);
    expect(recordInterest).toHaveBeenCalledWith('listing1', 'user1', 'view');
    expect(recordInterest).toHaveBeenCalledWith('listing2', 'user1', 'view');
  });

  it('always renames every anonymous view regardless of age, independent of the notify window', async () => {
    const { service, prisma } = makeService();
    (prisma.listingView.findMany as jest.Mock).mockResolvedValue([]); // nothing recent enough to notify about
    jest.spyOn(service, 'recordInterest').mockResolvedValue({ interested: true, notified: true });

    await service.linkListingViewsToUser('device-key', 'user1');

    expect(prisma.listingView.updateMany).toHaveBeenCalledWith({
      where: { viewerKey: 'anon:device-key' },
      data: { viewerKey: 'user:user1' },
    });
  });

  it("skips a listing recordInterest rejects (viewer's own, delisted, deleted) without failing the rest", async () => {
    const { service, prisma } = makeService();
    (prisma.listingView.findMany as jest.Mock).mockResolvedValue([
      { listingId: 'own-listing' },
      { listingId: 'listing2' },
    ]);
    const recordInterest = jest
      .spyOn(service, 'recordInterest')
      .mockRejectedValueOnce(new BadRequestException("You can't register interest in your own listing"))
      .mockResolvedValueOnce({ interested: true, notified: true });

    await expect(service.linkListingViewsToUser('device-key', 'user1')).resolves.toBeUndefined();

    expect(recordInterest).toHaveBeenCalledTimes(2);
    // The rename still runs even though one listing's retroactive notify failed.
    expect(prisma.listingView.updateMany).toHaveBeenCalled();
  });

  it('only calls recordInterest once for a listing viewed anonymously multiple times', async () => {
    const { service, prisma } = makeService();
    // distinct: ['listingId'] on the query means Prisma itself would collapse these — asserting
    // the query shape, not re-implementing Prisma's dedup, so this covers the call having the
    // right distinct clause rather than two rows ever actually reaching recordInterest.
    (prisma.listingView.findMany as jest.Mock).mockResolvedValue([{ listingId: 'listing1' }]);
    const recordInterest = jest.spyOn(service, 'recordInterest').mockResolvedValue({ interested: true, notified: true });

    await service.linkListingViewsToUser('device-key', 'user1');

    expect(recordInterest).toHaveBeenCalledTimes(1);
  });
});

describe('ListingsService.runPostLiveSideEffects — Post ad success conversion value', () => {
  // runPostLiveSideEffects is private; create() itself touches moderation, pricing, slots,
  // locations and three Prisma tables just to reach it, which would make a test of this one
  // side effect mostly a test of unrelated plumbing. Calling it directly (TS's `private` is a
  // compile-time check only) keeps this test scoped to what actually changed: does the right
  // value reach uploadClickConversion for a given category/transactionType.
  function makeSideEffectsService() {
    const uploadClickConversion = jest.fn().mockResolvedValue(undefined);
    const googleAdsConversionProvider = { uploadClickConversion } as unknown as GoogleAdsConversionProvider;
    const notificationsService = {
      notifyListingPosted: jest.fn().mockResolvedValue(null),
      publishToFacebookPage: jest.fn().mockResolvedValue(null),
    } as unknown as NotificationsService;
    const savedSearchesService = { notifyMatchingBuyers: jest.fn().mockResolvedValue(undefined) } as unknown as SavedSearchesService;
    const referralsService = { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService;
    const prisma = { listingNotificationLog: { create: jest.fn() } } as unknown as PrismaService;

    const service = new ListingsService(
      prisma,
      {} as ModerationService,
      { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
      notificationsService,
      savedSearchesService,
      {} as LocationsService,
      {} as R2StorageService,
      {} as CdnPurgeService,
      {} as ListingSlotsService,
      googleAdsConversionProvider,
      {} as ContactRevealService,
      {} as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
      { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService,
      referralsService,
    );
    return { service, uploadClickConversion };
  }

  function makeListing(category: string, transactionType: string) {
    return {
      id: 'listing1',
      ownerId: 'owner1',
      slug: 'a-nice-place',
      title: 'A nice place',
      price: 20000,
      priceQualifier: '',
      priceUnit: null,
      attributes: {},
      category,
      transactionType,
      publishedAt: new Date('2026-10-08T00:00:00Z'),
      createdAt: new Date('2026-10-08T00:00:00Z'),
      city: { name: 'Bengaluru' },
      area: { name: 'Koramangala' },
    };
  }

  const owner = { email: 'owner@example.com', phone: '9999999999', acquisitionGclid: 'gclid-abc' };

  it('attaches the segment value for a category/transactionType with its own entry', async () => {
    const { service, uploadClickConversion } = makeSideEffectsService();

    await (service as any).runPostLiveSideEffects(makeListing('plot', 'sell'), owner, true, 'owner1');

    expect(uploadClickConversion).toHaveBeenCalledWith(
      expect.objectContaining({ value: 2339, currency: 'INR' }),
    );
  });

  it('falls back through the chain for a thin category/transactionType combination', async () => {
    const { service, uploadClickConversion } = makeSideEffectsService();

    // "commercial|sell" has no segment entry (only 4 posters in the 2026-10-08 analysis) — falls
    // back to the "commercial" category value.
    await (service as any).runPostLiveSideEffects(makeListing('commercial', 'sell'), owner, true, 'owner1');

    expect(uploadClickConversion).toHaveBeenCalledWith(
      expect.objectContaining({ value: 2288, currency: 'INR' }),
    );
  });

  it('sends a real zero for Villa, not a fallback value', async () => {
    const { service, uploadClickConversion } = makeSideEffectsService();

    await (service as any).runPostLiveSideEffects(makeListing('villa', 'rent'), owner, true, 'owner1');

    expect(uploadClickConversion).toHaveBeenCalledWith(
      expect.objectContaining({ value: 0, currency: 'INR' }),
    );
  });

  it('does not upload anything when tracking was not authorized', async () => {
    const { service, uploadClickConversion } = makeSideEffectsService();

    await (service as any).runPostLiveSideEffects(makeListing('plot', 'sell'), owner, false, 'owner1');

    expect(uploadClickConversion).not.toHaveBeenCalled();
  });
});

describe('ListingsService.completePendingPublish — recovering the posting session for /post/success', () => {
  // Same reasoning as makeSideEffectsService above: this exercises completePendingPublish's own
  // logic (does it forward the row's own createSessionId?), not create()'s unrelated plumbing to
  // get a listing into pending_checkout in the first place.
  function makeService(listingOverrides: Record<string, unknown> = {}) {
    const recordPageView = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'listing1',
          ownerId: 'owner1',
          publishState: 'pending_checkout',
          category: 'apartment',
          transactionType: 'rent',
          price: 20000,
          priceQualifier: '',
          priceUnit: null,
          attributes: {},
          slug: 'a-nice-place',
          title: 'A nice place',
          createdAt: new Date('2026-10-08T00:00:00Z'),
          city: { name: 'Bengaluru' },
          area: { name: 'Koramangala' },
          createSessionId: 'session-abc',
          ...listingOverrides,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          deletedAt: null,
          name: 'Owner',
          email: null,
          phone: '9999999999',
          acquisitionGclid: null,
        }),
      },
      listingNotificationLog: { create: jest.fn() },
    } as unknown as PrismaService;
    const notificationsService = {
      notifyListingPosted: jest.fn().mockResolvedValue(null),
      publishToFacebookPage: jest.fn().mockResolvedValue(null),
    } as unknown as NotificationsService;
    const savedSearchesService = { notifyMatchingBuyers: jest.fn().mockResolvedValue(undefined) } as unknown as SavedSearchesService;
    const referralsService = { recordFirstApprovedAdIfReferred: jest.fn().mockResolvedValue(undefined) } as unknown as ReferralsService;
    const analyticsService = { recordPageView } as unknown as AnalyticsService;
    const googleAdsConversionProvider = {
      uploadClickConversion: jest.fn().mockResolvedValue(undefined),
    } as unknown as GoogleAdsConversionProvider;

    const service = new ListingsService(
      prisma,
      {} as ModerationService,
      { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
      notificationsService,
      savedSearchesService,
      {} as LocationsService,
      {} as R2StorageService,
      {} as CdnPurgeService,
      {} as ListingSlotsService,
      googleAdsConversionProvider,
      {} as ContactRevealService,
      {} as PlatformFeeSettingsService,
      { notifyListingInterest: jest.fn().mockResolvedValue(undefined), notifyListingFavourite: jest.fn().mockResolvedValue(undefined) } as never,
      analyticsService,
      referralsService,
    );
    return { service, recordPageView };
  }

  it('records /post/success against the session captured when the listing was first created', async () => {
    const { service, recordPageView } = makeService({ createSessionId: 'session-abc' });

    await service.completePendingPublish('listing1');

    expect(recordPageView).toHaveBeenCalledWith({ sessionId: 'session-abc', path: '/post/success' });
  });

  it('skips the write when no session was ever captured (admin/outreach-created listing)', async () => {
    const { service, recordPageView } = makeService({ createSessionId: null });

    await service.completePendingPublish('listing1');

    expect(recordPageView).not.toHaveBeenCalled();
  });
});
