import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppleIapService } from './apple-iap.service';
import { APPLE_PRODUCTS, APPLE_PRODUCT_PREFIX, appleProductById, boostProductId, boostTierFor } from './apple-products';
import { appleRootCertificates } from './apple-root-certificates';

const P = APPLE_PRODUCT_PREFIX;

type Tx = Record<string, unknown>;

function makeService() {
  const prisma = {
    applePurchaseIntent: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    payment: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    listing: { findUnique: jest.fn() },
    contactRevealSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { update: jest.fn() },
  };
  const config = { get: jest.fn() };
  const payments = { fulfilPaidPayment: jest.fn() };
  const service = new AppleIapService(prisma as never, config as never, payments as never);

  // Apple's verifier needs a real signed transaction; here it just hands back what the test says
  // the signed payload contains, so the logic AROUND verification is what is under test.
  const decoded: { tx?: Tx; notification?: Record<string, unknown> } = {};
  jest.spyOn(service as never, 'getVerifiers' as never).mockReturnValue([
    {
      verifyAndDecodeTransaction: jest.fn(async (signed: string) => {
        if (signed === 'bad') throw new Error('invalid signature');
        return decoded.tx;
      }),
      verifyAndDecodeNotification: jest.fn(async (signed: string) => {
        if (signed === 'bad') throw new Error('invalid signature');
        return decoded.notification;
      }),
    },
  ] as never);

  prisma.payment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pay1', ...data }));
  return { service, prisma, payments, decoded };
}

const subTx = (over: Tx = {}): Tx => ({
  transactionId: 'tx1',
  originalTransactionId: 'otx1',
  productId: `${P}plus.1m`,
  appAccountToken: 'intent1',
  expiresDate: Date.parse('2026-11-16T00:00:00Z'),
  purchaseDate: Date.parse('2026-10-16T00:00:00Z'),
  price: 99000,
  currency: 'INR',
  ...over,
});

const intent = (over: Record<string, unknown> = {}) => ({
  id: 'intent1',
  userId: 'u1',
  productId: `${P}plus.1m`,
  purpose: 'buyer_premium',
  listingId: null,
  boostDays: null,
  subscriptionMonths: 1,
  creditPackSize: null,
  ...over,
});

describe('Apple product catalogue', () => {
  it('has unique ids that all carry the bundle prefix', () => {
    const ids = APPLE_PRODUCTS.map((p) => p.productId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(P)).toBe(true);
  });

  it('covers the 5 subscriptions and 7 consumables the plan lists', () => {
    expect(APPLE_PRODUCTS.filter((p) => p.kind === 'subscription')).toHaveLength(5);
    expect(APPLE_PRODUCTS.filter((p) => p.kind === 'consumable')).toHaveLength(7);
  });

  it('maps listing categories to a boost tier, and pauses furniture and interiors', () => {
    expect(boostTierFor('apartment')).toBe('property');
    expect(boostTierFor('commercial')).toBe('property');
    expect(boostTierFor('pg')).toBe('other');
    expect(boostTierFor('coworking')).toBe('other');
    expect(boostTierFor('storage')).toBe('other');
    expect(boostTierFor('furniture')).toBeNull();
    expect(boostTierFor('interiors')).toBeNull();
  });

  it('builds boost product ids that exist in the catalogue', () => {
    for (const tier of ['property', 'other'] as const) {
      for (const days of [7, 15, 30] as const) expect(appleProductById(boostProductId(tier, days))).toBeDefined();
    }
  });
});

describe('Apple root certificates', () => {
  it('are valid, unexpired DER certificates', () => {
    const { X509Certificate } = require('node:crypto') as typeof import('node:crypto');
    const certs = appleRootCertificates();
    expect(certs.length).toBeGreaterThanOrEqual(2);
    for (const der of certs) {
      const cert = new X509Certificate(der);
      expect(cert.subject).toContain('Apple Root CA');
      expect(new Date(cert.validTo).getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe('AppleIapService.createIntent', () => {
  it('records a subscription intent for a known product only', async () => {
    const { service, prisma } = makeService();
    prisma.applePurchaseIntent.create.mockResolvedValue({ id: 'i1' });

    await expect(service.createIntent('u1', { type: 'subscription', productId: `${P}plus.6m` })).resolves.toEqual({
      intentId: 'i1',
      productId: `${P}plus.6m`,
    });
    expect(prisma.applePurchaseIntent.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      purpose: 'buyer_premium',
      subscriptionMonths: 6,
    });

    await expect(service.createIntent('u1', { type: 'subscription', productId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    // A consumable id is not a subscription product.
    await expect(service.createIntent('u1', { type: 'subscription', productId: `${P}credits.pack` })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('picks the boost product from the listing, never from the client', async () => {
    const { service, prisma } = makeService();
    prisma.applePurchaseIntent.create.mockResolvedValue({ id: 'i2' });
    prisma.listing.findUnique.mockResolvedValue({ id: 'l1', ownerId: 'u1', category: 'pg' });

    const result = await service.createIntent('u1', { type: 'boost', listingId: 'l1', boostDays: 15 });

    expect(result.productId).toBe(`${P}boost.other.15d`);
    expect(prisma.applePurchaseIntent.create.mock.calls[0][0].data).toMatchObject({ listingId: 'l1', boostDays: 15, purpose: 'listing_boost' });
  });

  it('refuses a boost on someone else’s listing, a missing listing, an unsupported category or duration', async () => {
    const { service, prisma } = makeService();
    prisma.listing.findUnique.mockResolvedValue({ id: 'l1', ownerId: 'other', category: 'apartment' });
    await expect(service.createIntent('u1', { type: 'boost', listingId: 'l1', boostDays: 7 })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.listing.findUnique.mockResolvedValue(null);
    await expect(service.createIntent('u1', { type: 'boost', listingId: 'x', boostDays: 7 })).rejects.toBeInstanceOf(NotFoundException);

    prisma.listing.findUnique.mockResolvedValue({ id: 'l1', ownerId: 'u1', category: 'furniture' });
    await expect(service.createIntent('u1', { type: 'boost', listingId: 'l1', boostDays: 7 })).rejects.toBeInstanceOf(BadRequestException);

    prisma.listing.findUnique.mockResolvedValue({ id: 'l1', ownerId: 'u1', category: 'apartment' });
    await expect(service.createIntent('u1', { type: 'boost', listingId: 'l1', boostDays: 9 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('takes the credit pack size from settings, not the client', async () => {
    const { service, prisma } = makeService();
    prisma.applePurchaseIntent.create.mockResolvedValue({ id: 'i3' });
    prisma.contactRevealSetting.findUnique.mockResolvedValue({ creditPackSize: 25 });

    await service.createIntent('u1', { type: 'credits' });

    expect(prisma.applePurchaseIntent.create.mock.calls[0][0].data).toMatchObject({ purpose: 'contact_reveal_credits', creditPackSize: 25 });
  });
});

describe('AppleIapService.verifyPurchase', () => {
  it('fulfils a subscription through the shared code, ending on Apple’s expiry date', async () => {
    const { service, prisma, payments, decoded } = makeService();
    decoded.tx = subTx();
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.applePurchaseIntent.findUnique.mockResolvedValue(intent());

    const result = await service.verifyPurchase('u1', 'signed');

    expect(result).toEqual({ productId: `${P}plus.1m`, purpose: 'buyer_premium', alreadyFulfilled: false });
    const row = prisma.payment.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      provider: 'apple',
      appleTransactionId: 'tx1',
      appleOriginalTransactionId: 'otx1',
      razorpayOrderId: 'apple_tx1',
      status: 'paid',
      purpose: 'buyer_premium',
      platform: 'app',
      amount: 9900, // 99.000 INR in milliunits -> 9900 paise
      currency: 'INR',
    });
    expect(payments.fulfilPaidPayment).toHaveBeenCalledTimes(1);
    expect(payments.fulfilPaidPayment.mock.calls[0][1]).toEqual(new Date('2026-11-16T00:00:00Z'));
    expect(prisma.applePurchaseIntent.update).toHaveBeenCalledWith({
      where: { id: 'intent1' },
      data: expect.objectContaining({ paymentId: 'pay1' }),
    });
  });

  it('fulfils a boost with its listing and Instant Alerts bundled, with no subscription end date', async () => {
    const { service, prisma, payments, decoded } = makeService();
    decoded.tx = subTx({ productId: `${P}boost.property.30d`, expiresDate: undefined });
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.applePurchaseIntent.findUnique.mockResolvedValue(
      intent({ productId: `${P}boost.property.30d`, purpose: 'listing_boost', listingId: 'l1', boostDays: 30, subscriptionMonths: null }),
    );

    await service.verifyPurchase('u1', 'signed');

    expect(prisma.payment.create.mock.calls[0][0].data).toMatchObject({
      purpose: 'listing_boost',
      listingId: 'l1',
      boostDays: 30,
      boostIncludesInstantAlerts: true,
    });
    expect(payments.fulfilPaidPayment.mock.calls[0][1]).toBeUndefined();
  });

  it('is a no-op the second time for the same transaction', async () => {
    const { service, prisma, payments, decoded } = makeService();
    decoded.tx = subTx();
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay1', userId: 'u1', purpose: 'buyer_premium' });

    const result = await service.verifyPurchase('u1', 'signed');

    expect(result.alreadyFulfilled).toBe(true);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(payments.fulfilPaidPayment).not.toHaveBeenCalled();
  });

  it('will not hand one account another account’s purchase', async () => {
    const { service, prisma, decoded } = makeService();
    decoded.tx = subTx();
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay1', userId: 'someone-else', purpose: 'buyer_premium' });
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(ForbiddenException);

    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.applePurchaseIntent.findUnique.mockResolvedValue(intent({ userId: 'someone-else' }));
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects what it cannot trust or match', async () => {
    const { service, prisma, payments, decoded } = makeService();
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.verifyPurchase('u1', 'bad')).rejects.toBeInstanceOf(BadRequestException); // signature

    decoded.tx = subTx({ productId: 'com.other.app.thing' });
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(BadRequestException); // not our product

    decoded.tx = subTx({ revocationDate: Date.now() });
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(BadRequestException); // refunded

    decoded.tx = subTx({ appAccountToken: undefined });
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(BadRequestException); // no order

    decoded.tx = subTx();
    prisma.applePurchaseIntent.findUnique.mockResolvedValue(null);
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(BadRequestException); // unknown order

    prisma.applePurchaseIntent.findUnique.mockResolvedValue(intent({ productId: `${P}plus.12m` }));
    await expect(service.verifyPurchase('u1', 'signed')).rejects.toBeInstanceOf(BadRequestException); // wrong product

    expect(payments.fulfilPaidPayment).not.toHaveBeenCalled();
  });
});

describe('AppleIapService.handleNotification', () => {
  const notification = (notificationType: string, tx: Tx) => ({ notificationType, data: { signedTransactionInfo: 'tx' }, tx });

  function setup(type: string, tx: Tx) {
    const ctx = makeService();
    ctx.decoded.notification = { notificationType: type, data: { signedTransactionInfo: 'tx' } };
    ctx.decoded.tx = tx;
    return ctx;
  }

  it('rejects a notification whose signature does not verify', async () => {
    const { service } = makeService();
    await expect(service.handleNotification('bad')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a renewal as a new payment for the same user and extends access to the new expiry', async () => {
    const { service, prisma, payments } = setup('DID_RENEW', subTx({ transactionId: 'tx2', expiresDate: Date.parse('2026-12-16T00:00:00Z') }));
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.findFirst.mockResolvedValue({ userId: 'u1' });

    await service.handleNotification('signed');

    expect(prisma.payment.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', appleTransactionId: 'tx2', subscriptionMonths: 1 });
    expect(payments.fulfilPaidPayment.mock.calls[0][1]).toEqual(new Date('2026-12-16T00:00:00Z'));
  });

  it('ignores a renewal it has already recorded, or cannot attribute to a user', async () => {
    const seen = setup('DID_RENEW', subTx({ transactionId: 'tx2' }));
    seen.prisma.payment.findUnique.mockResolvedValue({ id: 'already' });
    await seen.service.handleNotification('signed');
    expect(seen.prisma.payment.create).not.toHaveBeenCalled();

    const orphan = setup('DID_RENEW', subTx({ transactionId: 'tx3', appAccountToken: undefined }));
    orphan.prisma.payment.findUnique.mockResolvedValue(null);
    orphan.prisma.payment.findFirst.mockResolvedValue(null);
    await orphan.service.handleNotification('signed');
    expect(orphan.prisma.payment.create).not.toHaveBeenCalled();
  });

  it('a refund marks the payment refunded and ends a subscription now', async () => {
    const { service, prisma } = setup('REFUND', subTx());
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay1', userId: 'u1' });

    await service.handleNotification('signed');

    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: 'refunded' } });
    const update = prisma.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'u1' });
    expect(Object.keys(update.data)).toEqual(['premiumUntil']);
  });

  it('a consumable refund is recorded but does not touch the user', async () => {
    const { service, prisma } = setup('REFUND', subTx({ productId: `${P}boost.other.7d` }));
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay2', userId: 'u1' });

    await service.handleNotification('signed');

    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay2' }, data: { status: 'refunded' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('answers success for events it has nothing to do for', async () => {
    for (const type of ['EXPIRED', 'DID_FAIL_TO_RENEW', 'TEST', 'DID_CHANGE_RENEWAL_STATUS']) {
      const { service, prisma, payments } = setup(type, subTx());
      await expect(service.handleNotification('signed')).resolves.toBeUndefined();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(payments.fulfilPaidPayment).not.toHaveBeenCalled();
    }
    void notification;
  });
});
