import { PaymentsService } from './payments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import type { ListingsService } from '../listings/listings.service';
import type { ReferralsService } from '../referrals/referrals.service';
import {
  boostPriceFor,
  boostSavings,
  buildDisplayBoostPricing,
  defaultBoostDuration,
  enabledBoostDurations,
  offeredBoostDurations,
  DEFAULT_VALUE_BAND_RULES,
  type BoostPriceSettings,
  type BoostPricingRule,
} from '@bhavano/types/boostPricing';

/** The live prices at the time of writing: property boosts ₹99 / ₹179 / ₹299. */
const LIVE: BoostPriceSettings = {
  propertyBoostPrice7d: 99,
  propertyBoostPrice15d: 179,
  propertyBoostPrice30d: 299,
  coworkingPgStorageBoostPrice7d: 99,
  coworkingPgStorageBoostPrice15d: 179,
  coworkingPgStorageBoostPrice30d: 299,
  furnitureInteriorsBoostPrice7d: 49,
  furnitureInteriorsBoostPrice15d: 89,
  furnitureInteriorsBoostPrice30d: 149,
  showSelectorOnPreview: false,
  boost7dEnabled: true,
  boost15dEnabled: true,
  boost30dEnabled: true,
  allowSkippingBoost: true,
};

describe('boostPriceFor — three durations', () => {
  it('prices each duration for each category tier', () => {
    expect(boostPriceFor('apartment', 7, LIVE)).toBe(99);
    expect(boostPriceFor('apartment', 15, LIVE)).toBe(179);
    expect(boostPriceFor('apartment', 30, LIVE)).toBe(299);
    expect(boostPriceFor('pg', 30, LIVE)).toBe(299);
    expect(boostPriceFor('furniture', 7, LIVE)).toBe(49);
    expect(boostPriceFor('furniture', 30, LIVE)).toBe(149);
  });
});

describe('boostPriceFor — value bands (docs/plans/boost-proof-stat-and-value-bands.md)', () => {
  it('ignores valueBandRules entirely when no context is given — the pre-existing flat-tier path', () => {
    const settings = { ...LIVE, valueBandRules: DEFAULT_VALUE_BAND_RULES };
    expect(boostPriceFor('apartment', 7, settings)).toBe(99); // LIVE's flat price, not a band price
  });

  it('picks the matching band by value within a matching rule', () => {
    const settings = { ...LIVE, valueBandRules: DEFAULT_VALUE_BAND_RULES };
    // Property, sell: <50L, 50L-2Cr, >2Cr.
    expect(boostPriceFor('apartment', 7, settings, { transactionType: 'sell', value: 30_00_000 })).toBe(149);
    expect(boostPriceFor('apartment', 7, settings, { transactionType: 'sell', value: 80_00_000 })).toBe(199);
    expect(boostPriceFor('apartment', 7, settings, { transactionType: 'sell', value: 5_00_00_000 })).toBe(349);
  });

  it('uses a different cutoff/price set for rent than for sell, even on the same category', () => {
    const settings = { ...LIVE, valueBandRules: DEFAULT_VALUE_BAND_RULES };
    // ₹30,00,000 is a top-band SELL price, but as a RENT value (an absurd monthly rent) it's
    // also top-band — the point is the two rules have independent cutoffs/prices, not that this
    // particular number lands differently; confirm with a realistic monthly rent instead.
    expect(boostPriceFor('house', 15, settings, { transactionType: 'rent', value: 12_000 })).toBe(179);
    expect(boostPriceFor('house', 15, settings, { transactionType: 'rent', value: 80_000 })).toBe(499);
  });

  it('PG and coworking have their own rent-based bands, not the generic property-rent ones', () => {
    const settings = { ...LIVE, valueBandRules: DEFAULT_VALUE_BAND_RULES };
    expect(boostPriceFor('pg', 30, settings, { transactionType: 'rent', value: 8_000 })).toBe(299);
    expect(boostPriceFor('coworking', 30, settings, { transactionType: 'rent', value: 1_500 })).toBe(149);
  });

  it('falls back to the flat tier price when no rule matches the category/transactionType pair', () => {
    // No rule exists for storage at all.
    const settings = { ...LIVE, valueBandRules: DEFAULT_VALUE_BAND_RULES };
    expect(boostPriceFor('storage', 7, settings, { transactionType: 'rent', value: 5_000 })).toBe(99);
  });

  it('falls back to the flat tier price when valueBandRules is entirely absent (an existing settings row)', () => {
    expect(boostPriceFor('apartment', 7, LIVE, { transactionType: 'sell', value: 30_00_000 })).toBe(99);
  });

  it('uses the open-ended top band when value exceeds every explicit cutoff', () => {
    const oneRule: BoostPricingRule[] = [
      {
        categories: ['apartment'],
        transactionTypes: ['sell'],
        bands: [
          { maxValue: 100, price7d: 1, price15d: 2, price30d: 3 },
          { maxValue: null, price7d: 10, price15d: 20, price30d: 30 },
        ],
      },
    ];
    const settings = { ...LIVE, valueBandRules: oneRule };
    expect(boostPriceFor('apartment', 7, settings, { transactionType: 'sell', value: 999_999 })).toBe(10);
  });
});

describe('boostSavings — what a longer boost saves against the 7-day rate', () => {
  it('quotes the saving from the charged prices: 30 days at ₹299 vs ₹424 at the 7-day rate', () => {
    const pricing = buildDisplayBoostPricing('apartment', LIVE);
    expect(boostSavings(pricing, 30)).toEqual({ perDay: 10, rupees: 125, percent: 29 });
    expect(boostSavings(pricing, 15)).toEqual({ perDay: 12, rupees: 33, percent: 16 });
  });

  it('gives the same shape of saving with the promo applied to every duration', () => {
    const pricing = buildDisplayBoostPricing('apartment', LIVE, 50);
    // ₹50 / ₹90 / ₹150 after the promo.
    expect(pricing.boost7.amount).toBe(50);
    expect(pricing.boost30.amount).toBe(150);
    expect(boostSavings(pricing, 30)).toMatchObject({ perDay: 5, percent: 30 });
  });

  it('says nothing when there is nothing honest to say', () => {
    const free = { amount: 0, originalAmount: 0, discountApplied: false, free: true };
    const pricing = buildDisplayBoostPricing('apartment', LIVE);
    expect(boostSavings({ ...pricing, boost7: free }, 30)).toBeNull();
    // A longer option that is not cheaper per day earns no badge.
    const dearer = { ...pricing, boost30: { ...pricing.boost30, amount: 500 } };
    expect(boostSavings(dearer, 30)).toBeNull();
  });
});

describe('buildDisplayBoostPricing — Instant Alerts is part of the boost', () => {
  it('has no extra charge for alerts: the legacy "with alerts" options equal the plain ones', () => {
    const pricing = buildDisplayBoostPricing('apartment', LIVE);
    expect(pricing.boost7WithInstantAlerts).toEqual(pricing.boost7);
    expect(pricing.boost15WithInstantAlerts).toEqual(pricing.boost15);
    expect(pricing.boost30.amount).toBe(299);
  });
});

describe('boost durations admin can switch off', () => {
  it('offers only the durations that are on, shortest first', () => {
    expect(enabledBoostDurations(LIVE)).toEqual([7, 15, 30]);
    expect(enabledBoostDurations({ ...LIVE, boost7dEnabled: false })).toEqual([15, 30]);
    expect(buildDisplayBoostPricing('apartment', { ...LIVE, boost15dEnabled: false }).enabledDurations).toEqual([7, 30]);
  });

  it('treats a flag missing from an older server as on', () => {
    expect(enabledBoostDurations({})).toEqual([7, 15, 30]);
    expect(offeredBoostDurations({})).toEqual([7, 15, 30]);
    expect(offeredBoostDurations(null)).toEqual([7, 15, 30]);
  });

  it('pre-selects 15 days when offered, else the shortest duration on offer', () => {
    expect(defaultBoostDuration([7, 15, 30])).toBe(15);
    expect(defaultBoostDuration([7, 30])).toBe(7);
    expect(defaultBoostDuration([30])).toBe(30);
  });
});

function makePayments(
  overrides: {
    agentProUntil?: Date | null;
    settings?: BoostPriceSettings | null;
    referralCredit?: { days: number; expiresAt: string; available: number } | null;
  } = {},
) {
  const referralCredit = overrides.referralCredit ?? null;
  const create = jest.fn().mockResolvedValue({ id: 'order1' });
  const prisma = {
    listing: {
      findUnique: jest.fn().mockResolvedValue({ id: 'l1', ownerId: 'u1', category: 'apartment' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ expiresAt: new Date('2026-10-30T00:00:00Z') }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ agentProUntil: overrides.agentProUntil ?? null }) },
    boostPriceSetting: { findUnique: jest.fn().mockResolvedValue(overrides.settings ?? LIVE) },
    payment: { create: jest.fn().mockResolvedValue({ id: 'pay1' }) },
    listingInstantAlert: { create: jest.fn().mockResolvedValue({}) },
    proBoostCredit: { findUnique: jest.fn().mockResolvedValue(null) },
    discountCode: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  const service = new PaymentsService(
    prisma,
    { get: jest.fn().mockReturnValue('key') } as unknown as ConfigService,
    {} as NotificationsService,
    {} as GoogleAdsConversionProvider,
    {} as ListingsService,
    { getRedeemableCreditSummary: jest.fn().mockResolvedValue(referralCredit) } as unknown as ReferralsService,
  );
  (service as unknown as { getRazorpay: () => unknown }).getRazorpay = () => ({ orders: { create } });
  return { service, prisma, razorpayCreate: create };
}

describe('PaymentsService.createBoostOrder — 30 days, alerts included', () => {
  it('charges only the boost price for 30 days (₹299) and records that alerts are included', async () => {
    const { service, prisma, razorpayCreate } = makePayments();

    await service.createBoostOrder('u1', 'l1', 30);

    expect(razorpayCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 29900 }));
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 29900, boostDays: 30, boostIncludesInstantAlerts: true }),
    });
  });

  it('applies the promo to the new duration too (₹299 → ₹150 at 50% off)', async () => {
    const { service, prisma } = makePayments();
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue({
      id: 'dc1',
      code: 'BHAVANO-SEP',
      discountPercent: 50,
      active: true,
      expiresAt: null,
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
    });
    (prisma as unknown as { discountCodeRedemption: unknown }).discountCodeRedemption = {
      count: jest.fn().mockResolvedValue(0),
    };

    await service.createBoostOrder('u1', 'l1', 30, 'BHAVANO-SEP');

    expect(prisma.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 14950 }) });
  });

  it('records where the checkout started, so admin-message boosts can be counted', async () => {
    const { service, prisma } = makePayments();

    await service.createBoostOrder('u1', 'l1', 7, undefined, { source: 'admin_boost_message' });

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'admin_boost_message' }),
    });
  });

  it('refuses a duration admin has switched off, before creating any order', async () => {
    const { service, razorpayCreate } = makePayments({ settings: { ...LIVE, boost30dEnabled: false } });

    await expect(service.createBoostOrder('u1', 'l1', 30)).rejects.toThrow("The 30-day boost isn't offered right now");
    expect(razorpayCreate).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.createBoostOrder — redeeming a referral credit', () => {
  function makePaymentsWithReferralCredit(credit: { id: string; daysGranted: number } | null) {
    const create = jest.fn().mockResolvedValue({ id: 'order1' });
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({ id: 'l1', ownerId: 'u1', category: 'apartment' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ expiresAt: new Date('2026-10-30T00:00:00Z') }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ agentProUntil: null }) },
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay1' }) },
      listingBoost: { create: jest.fn().mockResolvedValue({}) },
      listingInstantAlert: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const referralsService = {
      findRedeemableCredit: jest.fn().mockResolvedValue(credit),
      markCreditRedeemed: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReferralsService;
    const service = new PaymentsService(
      prisma,
      { get: jest.fn().mockReturnValue('key') } as unknown as ConfigService,
      {} as NotificationsService,
      {} as GoogleAdsConversionProvider,
      {} as ListingsService,
      referralsService,
    );
    (service as unknown as { getRazorpay: () => unknown }).getRazorpay = () => ({ orders: { create } });
    return { service, prisma, referralsService, razorpayCreate: create };
  }

  it('skips Razorpay entirely and activates the boost for free, for the credit\'s own length — not the requested boostDays', async () => {
    const { service, prisma, referralsService, razorpayCreate } = makePaymentsWithReferralCredit({
      id: 'batch1',
      daysGranted: 3,
    });

    // boostDays:30 here is what the client's UI happened to have selected — the credit (3 days)
    // wins regardless, since redeeming a credit isn't "pick a duration and pay for it".
    const result = await service.createBoostOrder('u1', 'l1', 30, undefined, {}, true);

    expect(razorpayCreate).not.toHaveBeenCalled();
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 0, status: 'paid', boostDays: 3 }),
    });
    expect(referralsService.markCreditRedeemed).toHaveBeenCalledWith('batch1', 'l1', 'pay1');
    expect(result).toEqual({ paymentId: 'pay1', amount: 0, currency: 'INR', activated: true });
  });

  it('refuses the order outright when no credit is available, rather than silently charging', async () => {
    const { service, razorpayCreate, referralsService } = makePaymentsWithReferralCredit(null);

    await expect(service.createBoostOrder('u1', 'l1', 7, undefined, {}, true)).rejects.toThrow(
      'No free Feature credit available to use.',
    );
    expect(razorpayCreate).not.toHaveBeenCalled();
    expect(referralsService.markCreditRedeemed).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.previewBoostPricing — 30 days', () => {
  it('returns the 30-day price and no separate alerts charge', async () => {
    const { service } = makePayments();
    const preview = await service.previewBoostPricing('u1', 'apartment');
    expect(preview.boost30.amount).toBe(299);
    expect(preview.boost7WithInstantAlerts.amount).toBe(preview.boost7.amount);
    expect(preview.boost15WithInstantAlerts.amount).toBe(preview.boost15.amount);
  });

  it('lists only the durations that are on', async () => {
    const { service } = makePayments({ settings: { ...LIVE, boost7dEnabled: false } });
    const preview = await service.previewBoostPricing('u1', 'apartment');
    expect(preview.enabledDurations).toEqual([15, 30]);
  });

  it("keeps 7 days on offer for an Agent Pro's unused free credit even when it is off", async () => {
    const { service, prisma } = makePayments({
      agentProUntil: new Date(Date.now() + 86_400_000),
      settings: { ...LIVE, boost7dEnabled: false },
    });
    (prisma.proBoostCredit.findUnique as jest.Mock).mockResolvedValue({ redeemedAt: null });
    const preview = await service.previewBoostPricing('u1', 'apartment');
    expect(preview.enabledDurations).toEqual([7, 15, 30]);
    expect(preview.boost7.free).toBe(true);
  });

  it('reports a free referral boost alongside the prices, without changing them', async () => {
    const referralCredit = { days: 3, expiresAt: '2026-12-01T00:00:00.000Z', available: 2 };
    const { service } = makePayments({ referralCredit });
    const preview = await service.previewBoostPricing('u1', 'apartment');
    expect(preview.referralCredit).toEqual(referralCredit);
    expect(preview.boost30.amount).toBe(299);
  });
});

describe('PaymentsService.createListingPublishOrder — skipping Boost with no platform fee', () => {
  /** Reproduces the publish-checkout recovery screen: an owner who originally picked Boost opens
   * "Complete payment to publish" and taps "Skip — post without boosting" (BoostPlanSelector,
   * gated on allowSkippingBoost), so this is called with no boostDays. With every platform fee at
   * ₹0 (today's live settings) there is genuinely nothing left to charge — this must activate the
   * listing for free, not throw, the way it used to before this was a client-reachable case. */
  function makePublishOrder() {
    const completePendingPublish = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'l1',
          ownerId: 'u1',
          category: 'apartment',
          publishState: 'pending_checkout',
        }),
      },
      platformFeeSetting: {
        findUnique: jest.fn().mockResolvedValue({
          propertyListingFee: 0,
          coworkingPgStorageListingFee: 0,
          furnitureInteriorsListingFee: 0,
          allowLivePublishWithPendingPayment: false,
        }),
      },
      boostPriceSetting: { findUnique: jest.fn().mockResolvedValue(LIVE) },
      payment: {
        create: jest.fn().mockResolvedValue({
          id: 'pay1',
          userId: 'u1',
          listingId: 'l1',
          boostDays: null,
          boostIncludesInstantAlerts: false,
          adsTrackingAuthorized: null,
        }),
      },
      discountCode: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      { get: jest.fn().mockReturnValue('key') } as unknown as ConfigService,
      {} as NotificationsService,
      {} as GoogleAdsConversionProvider,
      { completePendingPublish } as unknown as ListingsService,
      {} as ReferralsService,
    );
    return { service, prisma, completePendingPublish };
  }

  it('activates the listing for free instead of throwing "Nothing to charge"', async () => {
    const { service, prisma, completePendingPublish } = makePublishOrder();

    const result = await service.createListingPublishOrder('u1', 'l1', undefined);

    expect(result).toEqual({ paymentId: 'pay1', amount: 0, currency: 'INR', activated: true });
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 0, status: 'paid', boostDays: null }),
    });
    expect(completePendingPublish).toHaveBeenCalledWith('l1', undefined);
  });
});

describe('PaymentsService — Instant Alerts bundled with a boost runs for the length of the boost', () => {
  const activate = (service: PaymentsService, until?: Date) =>
    (
      service as unknown as { activateInstantAlerts: (l: string, p: string, u?: Date) => Promise<void> }
    ).activateInstantAlerts('l1', 'pay1', until);

  it('ends with the boost when the boost ends before the listing does', async () => {
    const { service, prisma } = makePayments();
    const boostEnds = new Date('2026-10-07T00:00:00Z');

    await activate(service, boostEnds);

    expect(prisma.listingInstantAlert.create).toHaveBeenCalledWith({
      data: { listingId: 'l1', paymentId: 'pay1', activeUntil: boostEnds },
    });
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { instantAlertsUntil: boostEnds },
    });
  });

  it('never outlives the listing itself', async () => {
    const { service, prisma } = makePayments();
    await activate(service, new Date('2027-01-01T00:00:00Z'));
    expect(prisma.listingInstantAlert.create).toHaveBeenCalledWith({
      data: { listingId: 'l1', paymentId: 'pay1', activeUntil: new Date('2026-10-30T00:00:00Z') },
    });
  });

  it('runs to the listing expiry with no end given (the deprecated standalone purchase)', async () => {
    const { service, prisma } = makePayments();
    await activate(service);
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { instantAlertsUntil: new Date('2026-10-30T00:00:00Z') },
    });
  });
});
