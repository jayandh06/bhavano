import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import type { ListingsService } from '../listings/listings.service';
import type { ReferralsService } from '../referrals/referrals.service';

/** The admin grant of free Featured days (the PG and coworking operator pilot, docs/plans/pg-coworking-pilot-kit.md). */
const NOW = new Date('2026-11-03T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function make(listing: Record<string, unknown> | null) {
  const prisma = {
    listing: {
      findUnique: jest.fn().mockImplementation(({ select }: { select: Record<string, boolean> }) => {
        if (select.boostedUntil) return Promise.resolve({ boostedUntil: (listing as { boostedUntil?: Date } | null)?.boostedUntil ?? null });
        return Promise.resolve(listing);
      }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ expiresAt: (listing as { expiresAt: Date } | null)?.expiresAt }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: { create: jest.fn().mockResolvedValue({ id: 'pay1' }) },
    listingBoost: { create: jest.fn().mockResolvedValue({}) },
    listingInstantAlert: { create: jest.fn().mockResolvedValue({}) },
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    { get: jest.fn() } as unknown as ConfigService,
    {} as NotificationsService,
    {} as GoogleAdsConversionProvider,
    {} as ListingsService,
    {} as ReferralsService,
  );
  return { service, prisma };
}

const LIVE = {
  id: 'l1',
  ownerId: 'owner1',
  status: 'active',
  publishState: 'live',
  expiresAt: new Date(NOW.getTime() + 60 * DAY),
  owner: { phone: '9876543210' },
};

describe('PaymentsService.grantFreeBoost', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('records a paid-at-zero payment, the boost and Instant Alerts, tagged as an admin grant', async () => {
    const { service, prisma } = make(LIVE);
    const result = await service.grantFreeBoost('l1', 30, 'pilot_pg');

    expect(prisma.payment.create.mock.calls[0][0].data).toMatchObject({
      userId: 'owner1',
      amount: 0,
      purpose: 'listing_boost',
      listingId: 'l1',
      boostDays: 30,
      boostIncludesInstantAlerts: true,
      status: 'paid',
      source: 'admin_grant:pilot_pg',
    });
    const boostedUntil = new Date(NOW.getTime() + 30 * DAY);
    expect(prisma.listingBoost.create).toHaveBeenCalledWith({ data: { listingId: 'l1', paymentId: 'pay1', boostedUntil } });
    expect(prisma.listingInstantAlert.create).toHaveBeenCalledWith({ data: { listingId: 'l1', paymentId: 'pay1', activeUntil: boostedUntil } });
    expect(result).toEqual({ paymentId: 'pay1', boostedUntil: boostedUntil.toISOString(), listingExpiresAt: LIVE.expiresAt.toISOString() });
  });

  it('adds to a Feature period that is still running instead of replacing it', async () => {
    const current = new Date(NOW.getTime() + 10 * DAY);
    const { service, prisma } = make({ ...LIVE, boostedUntil: current });
    const result = await service.grantFreeBoost('l1', 7, 'pilot_pg');
    expect(prisma.listingBoost.create.mock.calls[0][0].data.boostedUntil).toEqual(new Date(current.getTime() + 7 * DAY));
    expect(result.boostedUntil).toBe(new Date(current.getTime() + 7 * DAY).toISOString());
  });

  it('caps Instant Alerts at the ad\'s own expiry and says when that is', async () => {
    const expiresAt = new Date(NOW.getTime() + 12 * DAY);
    const { service, prisma } = make({ ...LIVE, expiresAt });
    const result = await service.grantFreeBoost('l1', 30, 'pilot_pg');
    expect(prisma.listingInstantAlert.create.mock.calls[0][0].data.activeUntil).toEqual(expiresAt);
    expect(result.listingExpiresAt).toBe(expiresAt.toISOString());
  });

  it('refuses a missing ad, an unclaimed bulk-import ad, and one that is not live, without writing anything', async () => {
    const missing = make(null);
    await expect(missing.service.grantFreeBoost('x', 30, 'pilot_pg')).rejects.toBeInstanceOf(NotFoundException);

    const bulk = make({ ...LIVE, owner: { phone: '9000000002' } });
    await expect(bulk.service.grantFreeBoost('l1', 30, 'pilot_pg')).rejects.toBeInstanceOf(BadRequestException);

    const expired = make({ ...LIVE, status: 'expired' });
    await expect(expired.service.grantFreeBoost('l1', 30, 'pilot_pg')).rejects.toBeInstanceOf(BadRequestException);
    const pending = make({ ...LIVE, publishState: 'pending_checkout' });
    await expect(pending.service.grantFreeBoost('l1', 30, 'pilot_pg')).rejects.toBeInstanceOf(BadRequestException);

    for (const { prisma } of [missing, bulk, expired, pending]) expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
