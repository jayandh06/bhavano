import { PaymentsService } from './payments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import type { ListingsService } from '../listings/listings.service';
import {
  boostPriceFor,
  boostSavings,
  buildDisplayBoostPricing,
  type BoostPriceSettings,
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

function makePayments(overrides: { agentProUntil?: Date | null; settings?: BoostPriceSettings | null } = {}) {
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
});

describe('PaymentsService.previewBoostPricing — 30 days', () => {
  it('returns the 30-day price and no separate alerts charge', async () => {
    const { service } = makePayments();
    const preview = await service.previewBoostPricing('u1', 'apartment');
    expect(preview.boost30.amount).toBe(299);
    expect(preview.boost7WithInstantAlerts.amount).toBe(preview.boost7.amount);
    expect(preview.boost15WithInstantAlerts.amount).toBe(preview.boost15.amount);
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
