import { PaymentsService } from './payments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import type { ListingsService } from '../listings/listings.service';
import type { ReferralsService } from '../referrals/referrals.service';

/**
 * What the webhook reports to Google Ads, and — more importantly — what it refuses to report.
 *
 * This upload exists because the client-side tag only fires in a browser: nine boost purchases
 * from `google/cpc` clicks, every one with a gclid on file, were recorded by Ads as zero
 * conversions. The rules below are the ones that must not drift, because none of them fails
 * loudly: an ATT-denied buyer uploaded anyway is a privacy breach that looks like success, and a
 * wrong amount is a number nobody can spot from the outside.
 */
function make(overrides: { user?: Record<string, unknown> | null } = {}) {
  const uploadClickConversion = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    payment: { findUnique: jest.fn(), update: jest.fn() },
    discountCode: { findUnique: jest.fn() },
    discountCodeRedemption: { count: jest.fn().mockResolvedValue(0) },
    user: {
      findUnique: jest.fn().mockResolvedValue(
        'user' in overrides
          ? overrides.user
          : { email: 'buyer@example.com', phone: '9876543210', acquisitionGclid: 'CjwKCAgclid' },
      ),
    },
  } as unknown as PrismaService;

  const service = new PaymentsService(
    prisma,
    { get: jest.fn().mockReturnValue('') } as unknown as ConfigService,
    {} as NotificationsService,
    { uploadClickConversion } as unknown as GoogleAdsConversionProvider,
    { completePendingPublish: jest.fn() } as unknown as ListingsService,
    {} as ReferralsService,
  );
  return { service, uploadClickConversion, prisma };
}

const PAID = {
  id: 'pay_1',
  userId: 'u1',
  purpose: 'listing_boost',
  amount: 9950,
  currency: 'INR',
  paidAt: new Date('2026-09-20T09:00:00Z'),
  adsTrackingAuthorized: null as boolean | null,
  platform: null as string | null,
};

/** The method is private by design — nothing outside the webhook should report a conversion. */
const report = (service: PaymentsService, payment: Record<string, unknown>) =>
  (service as unknown as { reportPurchaseConversion: (p: unknown) => Promise<void> }).reportPurchaseConversion(payment);

describe('PaymentsService — purchase conversion upload', () => {
  it('reports the amount actually charged, in rupees, against the purpose’s own action', async () => {
    const { service, uploadClickConversion } = make();

    await report(service, PAID);

    expect(uploadClickConversion).toHaveBeenCalledWith({
      // "Boost purchase (offline)" — the UPLOAD_CLICKS action, not the browser tag's WEBPAGE one.
      conversionActionId: '7781548730',
      // 9950 paise → ₹99.50. Discounts are already reflected in `amount`, so this is what the
      // buyer actually paid rather than list price.
      value: 99.5,
      currency: 'INR',
      // The payment id, which is what makes a Razorpay webhook retry update the same event
      // instead of counting a second conversion.
      transactionId: 'pay_1',
      eventTimestamp: PAID.paidAt,
      eventSource: 'WEB',
      gclid: 'CjwKCAgclid',
      email: 'buyer@example.com',
      phone: '9876543210',
    });
  });

  it('never uploads for a buyer who denied App Tracking Transparency', async () => {
    const { service, uploadClickConversion, prisma } = make();

    await report(service, { ...PAID, adsTrackingAuthorized: false });

    expect(uploadClickConversion).not.toHaveBeenCalled();
    // Bails before even reading the buyer — no identity is touched for someone who said no.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('marks an in-app purchase as APP, which is the whole reason the column exists', async () => {
    const { service, uploadClickConversion } = make();

    await report(service, { ...PAID, platform: 'app' });

    expect(uploadClickConversion.mock.calls[0][0].eventSource).toBe('APP');
  });

  it.each([
    ['instant_alerts', '7781544854'],
    ['contact_reveal_credits', '7781653126'],
    ['buyer_premium', '7781648601'],
    ['agent_pro', '7781648601'],
    ['seller_slot_pack', '7781648601'],
  ])('maps %s to its conversion action', async (purpose, actionId) => {
    const { service, uploadClickConversion } = make();

    await report(service, { ...PAID, purpose });

    expect(uploadClickConversion.mock.calls[0][0].conversionActionId).toBe(actionId);
  });

  it('uploads nothing for a purpose it has no action for, rather than guessing one', async () => {
    const { service, uploadClickConversion } = make();

    await report(service, { ...PAID, purpose: 'something_new' });

    expect(uploadClickConversion).not.toHaveBeenCalled();
  });

  it('still reports a buyer with no gclid — enhanced conversions can match on email alone', async () => {
    const { service, uploadClickConversion } = make({
      user: { email: 'buyer@example.com', phone: null, acquisitionGclid: null },
    });

    await report(service, PAID);

    const arg = uploadClickConversion.mock.calls[0][0];
    expect(arg.gclid).toBeUndefined();
    expect(arg.email).toBe('buyer@example.com');
  });

  it('swallows an upload failure — reporting must never disturb a paid purchase', async () => {
    const { service, uploadClickConversion } = make();
    uploadClickConversion.mockRejectedValueOnce(new Error('Ads API down'));

    await expect(report(service, PAID)).resolves.toBeUndefined();
  });
});

/**
 * Every create*Order method (createBoostOrder, createListingPublishOrder,
 * createInstantAlertsOrder, createSubscriptionOrder, createContactRevealCreditsOrder) passes its
 * discountCode through resolveDiscountCodeSafely rather than the throwing resolveDiscountCode
 * directly. This is the regression case: every current caller auto-applies ACTIVE_PROMO_CODE
 * (packages/types/src/promoCode.ts) on every checkout, not just when a buyer typed one in, so once
 * that code expires or is deactivated, an unguarded resolveDiscountCode call turns "no discount
 * available" into "reject the entire purchase" — which is exactly what happened when BHAVANO-SEP
 * expired. resolveDiscountCode itself is still private and untouched; this only pins the wrapper's
 * degrade-not-throw contract, since that's what every checkout path now actually depends on.
 */
const resolveSafely = (service: PaymentsService, code: string | undefined, userId = 'u1') =>
  (
    service as unknown as {
      resolveDiscountCodeSafely: (c: string | undefined, u: string) => Promise<{ id: string; discountPercent: number } | null>;
    }
  ).resolveDiscountCodeSafely(code, userId);

describe('PaymentsService — resolveDiscountCodeSafely', () => {
  it('resolves an active, unexpired code normally', async () => {
    const { service, prisma } = make();
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue({
      id: 'dc1',
      code: 'BHAVANO-SEP',
      active: true,
      expiresAt: null,
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
      discountPercent: 50,
    });

    await expect(resolveSafely(service, 'BHAVANO-SEP')).resolves.toEqual({ id: 'dc1', discountPercent: 50 });
  });

  it('degrades to no discount, not a thrown error, once the code has expired', async () => {
    const { service, prisma } = make();
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue({
      id: 'dc1',
      code: 'BHAVANO-SEP',
      active: true,
      expiresAt: new Date(Date.now() - 60_000), // a minute in the past, whenever this test runs
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
      discountPercent: 50,
    });

    await expect(resolveSafely(service, 'BHAVANO-SEP')).resolves.toBeNull();
  });

  it('degrades to no discount when the code has been deactivated', async () => {
    const { service, prisma } = make();
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue({
      id: 'dc1',
      code: 'BHAVANO-SEP',
      active: false,
      expiresAt: null,
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
      discountPercent: 50,
    });

    await expect(resolveSafely(service, 'BHAVANO-SEP')).resolves.toBeNull();
  });

  it('degrades to no discount for a code that does not exist at all', async () => {
    const { service, prisma } = make();
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(resolveSafely(service, 'NOT-A-REAL-CODE')).resolves.toBeNull();
  });

  it('degrades to no discount once the redemption cap is reached', async () => {
    const { service, prisma } = make();
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue({
      id: 'dc1',
      code: 'BHAVANO-SEP',
      active: true,
      expiresAt: null,
      maxRedemptions: 100,
      maxRedemptionsPerUser: 1,
      discountPercent: 50,
    });
    (prisma.discountCodeRedemption.count as jest.Mock).mockResolvedValue(100);

    await expect(resolveSafely(service, 'BHAVANO-SEP')).resolves.toBeNull();
  });

  it('returns null with no code passed, same as resolveDiscountCode', async () => {
    const { service } = make();

    await expect(resolveSafely(service, undefined)).resolves.toBeNull();
  });
});
