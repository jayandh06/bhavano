import { PaymentsService } from './payments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { GoogleAdsConversionProvider } from '../ads/google-ads-conversion.provider';
import type { ListingsService } from '../listings/listings.service';

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
