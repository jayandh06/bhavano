import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';
import type { Payment } from '@prisma/client';
import type { ListingCategory } from '@bhavano/types';
import { BOOST_DURATIONS, type BoostDurationDays } from '@bhavano/types/boostPricing';
import { PrismaService } from '../../prisma/prisma.service';
import { CONTACT_REVEAL_SETTINGS_ID, DEFAULT_CONTACT_REVEAL_SETTINGS } from '../../contact-reveal/contact-reveal.constants';
import { PaymentsService } from '../payments.service';
import { appleRootCertificates } from './apple-root-certificates';
import { APPLE_PRODUCT_PREFIX, appleProductById, boostProductId, boostTierFor, type AppleProduct } from './apple-products';

/** What the app asks to buy. The server turns it into a concrete product: the client never names a
 * boost product itself, so it cannot buy the cheap tier for an expensive listing. */
export type CreateAppleIntentInput =
  | { type: 'subscription'; productId: string }
  | { type: 'boost'; listingId: string; boostDays: number }
  | { type: 'credits' };

export interface AppleIntentResult {
  /** Handed to StoreKit as the `appAccountToken`. */
  intentId: string;
  productId: string;
}

export interface AppleVerifyResult {
  productId: string;
  purpose: Payment['purpose'];
  /** True when this exact transaction had already been fulfilled (a retry or a restore). */
  alreadyFulfilled: boolean;
}

const DEFAULT_BUNDLE_ID = 'com.finfolia.bhavano';
// The app's Apple id (also `ascAppId` in apps/mobile/eas.json). Not a secret.
const DEFAULT_APP_APPLE_ID = 6811878602;

/** In-App Purchase on the iOS app: record what is about to be bought, verify Apple's signed
 * transaction, and fulfil through the same code as the Razorpay webhook. See
 * docs/plans/ios-in-app-purchase.md.
 *
 * Nothing the client says is trusted for what was bought or by whom: the purchase is tied to a
 * server-side intent by the `appAccountToken` inside Apple's signed transaction, and the signature
 * is checked against Apple's root certificates. */
@Injectable()
export class AppleIapService {
  private readonly logger = new Logger(AppleIapService.name);
  private verifiers?: SignedDataVerifier[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
  ) {}

  /** Production first, then Sandbox: TestFlight builds and App Review's own device purchase against
   * the Sandbox environment, and the same backend has to accept both. */
  private getVerifiers(): SignedDataVerifier[] {
    if (!this.verifiers) {
      const bundleId = this.config.get<string>('APPLE_IAP_BUNDLE_ID') ?? DEFAULT_BUNDLE_ID;
      const appAppleId = Number(this.config.get<string>('APPLE_APP_ID') ?? DEFAULT_APP_APPLE_ID);
      const roots = appleRootCertificates();
      this.verifiers = [
        new SignedDataVerifier(roots, true, Environment.PRODUCTION, bundleId, appAppleId),
        new SignedDataVerifier(roots, true, Environment.SANDBOX, bundleId),
      ];
    }
    return this.verifiers;
  }

  private async decodeTransaction(signed: string): Promise<JWSTransactionDecodedPayload> {
    let lastError: unknown;
    for (const verifier of this.getVerifiers()) {
      try {
        return await verifier.verifyAndDecodeTransaction(signed);
      } catch (error) {
        lastError = error;
      }
    }
    this.logger.warn(`Rejected an Apple transaction that did not verify: ${String(lastError)}`);
    throw new BadRequestException('Could not verify this purchase with Apple.');
  }

  private async decodeNotification(signed: string): Promise<ResponseBodyV2DecodedPayload> {
    let lastError: unknown;
    for (const verifier of this.getVerifiers()) {
      try {
        return await verifier.verifyAndDecodeNotification(signed);
      } catch (error) {
        lastError = error;
      }
    }
    this.logger.warn(`Rejected an Apple notification that did not verify: ${String(lastError)}`);
    throw new BadRequestException('Invalid notification signature');
  }

  // ---------------------------------------------------------------- intent

  async createIntent(userId: string, input: CreateAppleIntentInput): Promise<AppleIntentResult> {
    if (input.type === 'subscription') {
      const product = appleProductById(input.productId);
      if (!product || product.kind !== 'subscription') throw new BadRequestException('Unknown subscription product');
      return this.saveIntent(userId, product, { subscriptionMonths: product.months });
    }

    if (input.type === 'credits') {
      const product = appleProductById(`${APPLE_PRODUCT_PREFIX}credits.pack`);
      if (!product) throw new BadRequestException('Credits are not available on iOS');
      const settings =
        (await this.prisma.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ??
        DEFAULT_CONTACT_REVEAL_SETTINGS;
      return this.saveIntent(userId, product, { creditPackSize: settings.creditPackSize });
    }

    const boostDays = input.boostDays as BoostDurationDays;
    if (!BOOST_DURATIONS.includes(boostDays)) throw new BadRequestException('Unsupported boost duration');
    const listing = await this.prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw new NotFoundException(`Listing ${input.listingId} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");
    const tier = boostTierFor(listing.category as ListingCategory);
    if (!tier) throw new BadRequestException('Boosts are not available for this category on iOS');
    const product = appleProductById(boostProductId(tier, boostDays));
    if (!product) throw new BadRequestException('Unsupported boost duration');
    return this.saveIntent(userId, product, { listingId: listing.id, boostDays });
  }

  private async saveIntent(
    userId: string,
    product: AppleProduct,
    extra: { listingId?: string; boostDays?: number; subscriptionMonths?: number; creditPackSize?: number },
  ): Promise<AppleIntentResult> {
    const intent = await this.prisma.applePurchaseIntent.create({
      data: { userId, productId: product.productId, purpose: product.purpose, ...extra },
    });
    return { intentId: intent.id, productId: product.productId };
  }

  // ---------------------------------------------------------------- verify

  /** Verifies one signed transaction from the device and fulfils it. Safe to call again for the same
   * transaction (a retry after a dropped response, or a Restore Purchases): the second call changes
   * nothing and says so. */
  async verifyPurchase(userId: string, signedTransaction: string): Promise<AppleVerifyResult> {
    const tx = await this.decodeTransaction(signedTransaction);
    const product = appleProductById(tx.productId);
    if (!product || !tx.transactionId) throw new BadRequestException('This purchase is not for a Bhavano product.');
    if (tx.revocationDate) throw new BadRequestException('This purchase was refunded.');

    const existing = await this.prisma.payment.findUnique({ where: { appleTransactionId: tx.transactionId } });
    if (existing) {
      if (existing.userId !== userId) throw new ForbiddenException('This purchase belongs to a different account.');
      return { productId: product.productId, purpose: existing.purpose, alreadyFulfilled: true };
    }

    const intent = tx.appAccountToken
      ? await this.prisma.applePurchaseIntent.findUnique({ where: { id: tx.appAccountToken } })
      : null;
    if (!intent) throw new BadRequestException('This purchase could not be matched to an order.');
    if (intent.userId !== userId) throw new ForbiddenException('This purchase belongs to a different account.');
    if (intent.productId !== tx.productId) throw new BadRequestException('Purchase does not match the order.');

    const payment = await this.recordPayment(tx, product, intent);
    await this.prisma.applePurchaseIntent.update({
      where: { id: intent.id },
      data: { paymentId: payment.id, fulfilledAt: new Date() },
    });
    await this.fulfil(payment, tx, product);
    return { productId: product.productId, purpose: payment.purpose, alreadyFulfilled: false };
  }

  /** The payment row for one Apple charge, already `paid`. Apple's price is in milliunits of the
   * storefront currency; the payments table keeps minor units (paise for INR). */
  private async recordPayment(
    tx: JWSTransactionDecodedPayload,
    product: AppleProduct,
    intent: {
      userId: string;
      listingId: string | null;
      boostDays: number | null;
      subscriptionMonths: number | null;
      creditPackSize: number | null;
    },
  ): Promise<Payment> {
    const transactionId = tx.transactionId as string;
    return this.prisma.payment.create({
      data: {
        userId: intent.userId,
        provider: 'apple',
        razorpayOrderId: `apple_${transactionId}`,
        razorpayPaymentId: `apple_${transactionId}`,
        appleTransactionId: transactionId,
        appleOriginalTransactionId: tx.originalTransactionId,
        appleProductId: tx.productId,
        amount: tx.price ? Math.round(tx.price / 10) : 0,
        currency: tx.currency ?? 'INR',
        status: 'paid',
        paidAt: tx.purchaseDate ? new Date(tx.purchaseDate) : new Date(),
        purpose: product.purpose,
        listingId: intent.listingId,
        boostDays: intent.boostDays,
        boostIncludesInstantAlerts: product.purpose === 'listing_boost',
        subscriptionMonths: intent.subscriptionMonths,
        agentProUnits: product.purpose === 'agent_pro' ? 1 : null,
        creditPackSize: intent.creditPackSize,
        platform: 'app',
      },
    });
  }

  private async fulfil(payment: Payment, tx: JWSTransactionDecodedPayload, product: AppleProduct): Promise<void> {
    const endsAt = product.kind === 'subscription' && tx.expiresDate ? new Date(tx.expiresDate) : undefined;
    await this.payments.fulfilPaidPayment(payment, endsAt);
  }

  // ---------------------------------------------------------- notifications

  /** App Store Server Notifications V2. Apple calls this when a subscription renews, lapses or is
   * refunded, and when a consumable is refunded: events that happen with no app open. Always
   * answers success for a notification that verifies, even one it has nothing to do for, so Apple
   * does not keep retrying it. */
  async handleNotification(signedPayload: string): Promise<void> {
    const notification = await this.decodeNotification(signedPayload);
    const type = String(notification.notificationType ?? '');
    const signedTx = notification.data?.signedTransactionInfo;
    if (!signedTx) {
      this.logger.log(`Apple notification ${type} carried no transaction — nothing to do`);
      return;
    }
    const tx = await this.decodeTransaction(signedTx);
    const product = appleProductById(tx.productId);
    if (!product || !tx.transactionId) return;

    switch (type) {
      case 'DID_RENEW':
      case 'SUBSCRIBED':
      case 'OFFER_REDEEMED':
        await this.recordRenewal(tx, product);
        return;
      case 'REFUND':
      case 'REVOKE':
        await this.recordRefund(tx, product);
        return;
      default:
        // EXPIRED, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED, DID_CHANGE_RENEWAL_STATUS, TEST …:
        // access already ends on the expiry date we stored, so there is nothing to change.
        this.logger.log(`Apple notification ${type} for ${tx.productId} — no action needed`);
    }
  }

  /** A renewal is a new charge with its own transactionId, so it gets its own payment row and
   * extends access to Apple's new expiry. The user comes from an earlier payment on the same
   * subscription (same originalTransactionId), or from the intent if this is the first we hear of it. */
  private async recordRenewal(tx: JWSTransactionDecodedPayload, product: AppleProduct): Promise<void> {
    if (product.kind !== 'subscription') return;
    const transactionId = tx.transactionId as string;
    if (await this.prisma.payment.findUnique({ where: { appleTransactionId: transactionId } })) return;

    const earlier = tx.originalTransactionId
      ? await this.prisma.payment.findFirst({
          where: { appleOriginalTransactionId: tx.originalTransactionId },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const intent = tx.appAccountToken
      ? await this.prisma.applePurchaseIntent.findUnique({ where: { id: tx.appAccountToken } })
      : null;
    const userId = earlier?.userId ?? intent?.userId;
    if (!userId) {
      this.logger.warn(`Renewal ${transactionId} could not be matched to a user — ignored`);
      return;
    }

    const payment = await this.recordPayment(tx, product, {
      userId,
      listingId: null,
      boostDays: null,
      subscriptionMonths: product.months,
      creditPackSize: null,
    });
    await this.fulfil(payment, tx, product);
  }

  /** A refund ends the access it bought. Subscriptions are cut off now; a consumable already spent
   * (a boost that ran, credits that were used) is recorded as refunded for a human to follow up. */
  private async recordRefund(tx: JWSTransactionDecodedPayload, product: AppleProduct): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { appleTransactionId: tx.transactionId as string } });
    if (!payment) return;
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });

    if (product.kind === 'subscription') {
      const now = new Date();
      const field =
        product.purpose === 'buyer_premium'
          ? 'premiumUntil'
          : product.purpose === 'seller_slot_pack'
            ? 'sellerSlotPackUntil'
            : 'agentProUntil';
      await this.prisma.user.update({ where: { id: payment.userId }, data: { [field]: now } });
      this.logger.log(`Apple refund ended ${product.purpose} for user ${payment.userId}`);
    } else {
      this.logger.warn(
        `Apple refunded a ${product.purpose} (payment ${payment.id}). The benefit was not reversed — review it manually.`,
      );
    }
  }
}
