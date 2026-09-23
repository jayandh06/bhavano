import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import type {
  BoostPricingOptionDto,
  BoostPricingPreviewDto,
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateInstantAlertsOrderResponseDto,
  CreateListingPublishOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
  ListingCategory,
  PaymentHistoryPage,
  SubscriptionTier,
} from '@bhavano/types';
import { boostPriceFor, type BoostDurationDays } from '@bhavano/types/boostPricing';
import { subscriptionPriceFor } from '@bhavano/types/subscriptionPricing';
import { DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS } from '@bhavano/types/instantAlertsPricing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  GoogleAdsConversionProvider,
  PURCHASE_CONVERSION_ACTION_IDS,
} from '../ads/google-ads-conversion.provider';
import { CONTACT_REVEAL_SETTINGS_ID, DEFAULT_CONTACT_REVEAL_SETTINGS } from '../contact-reveal/contact-reveal.constants';
import {
  BOOST_PRICE_SETTINGS_ID,
  DEFAULT_BOOST_PRICE_SETTINGS,
  SUBSCRIPTION_PLAN_SETTINGS_ID,
  DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
  INSTANT_ALERTS_PRICE_SETTINGS_ID,
  PLATFORM_FEE_SETTINGS_ID,
} from '../plans/plans.constants';
import { platformFeeFor } from '@bhavano/types/platformFeePricing';
import { ListingsService } from '../listings/listings.service';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
      };
    };
  };
}

function utcMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Captured when an order is created and stored on the Payment, because the Razorpay webhook that
 * later reports the purchase to Google Ads is a server-to-server callback that sees neither. See
 * Payment.adsTrackingAuthorized / Payment.platform. */
export interface PurchaseContext {
  adsTrackingAuthorized?: boolean;
  platform?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly googleAdsConversionProvider: GoogleAdsConversionProvider,
    private readonly listingsService: ListingsService,
  ) {}

  private getRazorpay(): Razorpay {
    if (this.razorpay) return this.razorpay;
    const key_id = this.config.get<string>('RAZORPAY_KEY_ID');
    const key_secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!key_id || !key_secret) {
      throw new ServiceUnavailableException('Payments are not configured on this server yet');
    }
    this.razorpay = new Razorpay({ key_id, key_secret });
    return this.razorpay;
  }

  /**
   * Tells Google Ads a purchase happened, with the amount actually charged.
   *
   * Uploaded server-side (Data Manager API, see GoogleAdsConversionProvider) rather than left to
   * the client-side tag, for the reason the data showed: the tag only fires in a browser, so
   * purchases made in the mobile app — where sellers manage their listings — were reported
   * nowhere at all, and a blocked or closed tab loses a share of the rest.
   *
   * Three things gate it, all deliberate:
   *
   * - **ATT.** A buyer whose device denied App Tracking Transparency is never uploaded. That
   *   decision is read from `Payment.adsTrackingAuthorized`, captured when the order was created,
   *   because this webhook is a server-to-server callback with no such header.
   * - **A known purpose.** An unmapped purpose uploads nothing rather than guessing an action.
   * - **Identity.** The provider skips when there is neither a gclid nor a hashed email/phone —
   *   an event Ads cannot attribute to anyone is noise.
   *
   * `transactionId` is the payment id, which is what makes this idempotent: Razorpay retries
   * webhooks, and a repeated ingest with the same id updates that event rather than counting a
   * second conversion.
   */
  private async reportPurchaseConversion(payment: {
    id: string;
    userId: string;
    purpose: string;
    amount: number;
    currency: string;
    paidAt: Date;
    adsTrackingAuthorized: boolean | null;
    platform: string | null;
  }): Promise<void> {
    if (payment.adsTrackingAuthorized === false) return;

    const conversionActionId = PURCHASE_CONVERSION_ACTION_IDS[payment.purpose];
    if (!conversionActionId) {
      this.logger.warn(`No conversion action mapped for purpose ${payment.purpose} — not reported to Ads`);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payment.userId },
      select: { email: true, phone: true, acquisitionGclid: true },
    });
    if (!user) return;

    await this.googleAdsConversionProvider
      .uploadClickConversion({
        conversionActionId,
        // Paise to rupees — the figure actually charged, discount included, matching what the
        // client-side tag reports for the purchases it does see.
        value: payment.amount / 100,
        currency: payment.currency,
        transactionId: payment.id,
        eventTimestamp: payment.paidAt,
        eventSource: payment.platform === 'app' ? 'APP' : 'WEB',
        gclid: user.acquisitionGclid ?? undefined,
        email: user.email,
        phone: user.phone,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Ads conversion upload failed for payment ${payment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  private async activateListingBoost(listingId: string, boostDays: number, paymentId: string): Promise<void> {
    const boostedUntil = new Date(Date.now() + boostDays * 24 * 60 * 60 * 1000);
    await this.prisma.listingBoost.create({
      data: { listingId, paymentId, boostedUntil },
    });
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { boostedUntil, boostRank: Math.random() },
    });
  }

  /** Unlike activateListingBoost, activeUntil isn't computed from a purchased duration — it's
   * the listing's own *current* expiresAt, re-read here (webhook time) rather than at order
   * creation, in case the listing was renewed in between. */
  private async activateInstantAlerts(listingId: string, paymentId: string): Promise<void> {
    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      select: { expiresAt: true },
    });
    await this.prisma.listingInstantAlert.create({
      data: { listingId, paymentId, activeUntil: listing.expiresAt },
    });
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { instantAlertsUntil: listing.expiresAt },
    });
  }

  /** Best-effort, fire-and-forget confirmation that the purchase actually went through — never
   * blocks the webhook from returning 200 to Razorpay. Logged to ListingNotificationLog on a
   * successful send, same pattern as every other notification in this codebase. */
  private notifyInstantAlertsActivated(listingId: string): void {
    void this.deliverInstantAlertsActivatedNotification(listingId).catch((err: unknown) =>
      this.logger.error(`Failed to send Instant Alerts confirmation for listing ${listingId}`, err),
    );
  }

  private async deliverInstantAlertsActivatedNotification(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { title: true, owner: { select: { email: true, phone: true } } },
    });
    if (!listing) return;

    const channel = await this.notificationsService.notifyInstantAlertsActivated(listing.owner, listing.title);
    if (channel) {
      await this.prisma.listingNotificationLog.create({
        data: { listingId, kind: 'instant_alerts_activated', channel },
      });
    }
  }

  /** Same fire-and-forget/log pattern as `notifyInstantAlertsActivated` above, for the Boost
   * purchase confirmation. */
  private notifyListingBoostActivated(listingId: string, boostDays: number): void {
    void this.deliverListingBoostActivatedNotification(listingId, boostDays).catch((err: unknown) =>
      this.logger.error(`Failed to send Boost confirmation for listing ${listingId}`, err),
    );
  }

  private async deliverListingBoostActivatedNotification(listingId: string, boostDays: number): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { title: true, owner: { select: { email: true, phone: true } } },
    });
    if (!listing) return;

    const channel = await this.notificationsService.notifyListingBoostActivated(listing.owner, listing.title, boostDays);
    if (channel) {
      await this.prisma.listingNotificationLog.create({
        data: { listingId, kind: 'boost_activated', channel },
      });
    }
  }

  /** Same fire-and-forget/log pattern as `notifyListingBoostActivated` above, for the Boost +
   * Instant Alerts bundle — one combined confirmation instead of two separate emails for what
   * the buyer experienced as a single purchase. */
  private notifyBoostAndInstantAlertsActivated(listingId: string, boostDays: number): void {
    void this.deliverBoostAndInstantAlertsActivatedNotification(listingId, boostDays).catch((err: unknown) =>
      this.logger.error(`Failed to send Boost+Instant Alerts confirmation for listing ${listingId}`, err),
    );
  }

  private async deliverBoostAndInstantAlertsActivatedNotification(listingId: string, boostDays: number): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { title: true, owner: { select: { email: true, phone: true } } },
    });
    if (!listing) return;

    const channel = await this.notificationsService.notifyBoostAndInstantAlertsActivated(listing.owner, listing.title, boostDays);
    if (channel) {
      await this.prisma.listingNotificationLog.create({
        data: { listingId, kind: 'boost_and_instant_alerts_activated', channel },
      });
    }
  }

  /** Same fire-and-forget pattern as the listing-scoped confirmations above, for the four
   * user-scoped purchases (no listing involved) — logged to UserNotificationLog instead of
   * ListingNotificationLog. `send` is whichever NotificationsService method matches this
   * purchase; this helper only handles the "fetch the user, dispatch, log on success" plumbing
   * shared by all four. */
  private notifyUserPurchaseActivated(
    userId: string,
    kind: string,
    send: (user: { email: string | null; phone: string | null }) => Promise<'email' | 'whatsapp' | null>,
  ): void {
    void this.deliverUserPurchaseNotification(userId, kind, send).catch((err: unknown) =>
      this.logger.error(`Failed to send ${kind} confirmation for user ${userId}`, err),
    );
  }

  private async deliverUserPurchaseNotification(
    userId: string,
    kind: string,
    send: (user: { email: string | null; phone: string | null }) => Promise<'email' | 'whatsapp' | null>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
    if (!user) return;

    const channel = await send(user);
    if (channel) {
      await this.prisma.userNotificationLog.create({ data: { userId, kind, channel } });
    }
  }

  private async ensureProBoostCreditForMonth(userId: string): Promise<void> {
    const monthKey = utcMonthKey();
    await this.prisma.proBoostCredit.upsert({
      where: { userId_monthKey: { userId, monthKey } },
      create: { userId, monthKey },
      update: {},
    });
  }

  /** Validates a discount code (active, not expired, under both its total and per-user
   * redemption caps) without creating a DiscountCodeRedemption row — that only happens once the
   * webhook confirms `paid`, so an abandoned checkout never consumes a redemption slot. Redemption
   * counts are checked against DiscountCodeRedemption (not Payment), since only paid orders ever
   * create one. Throws rather than silently ignoring an invalid code, so a typo doesn't produce a
   * surprise full-price charge. */
  private async resolveDiscountCode(
    code: string | undefined,
    userId: string,
  ): Promise<{ id: string; discountPercent: number } | null> {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) return null;

    const discountCode = await this.prisma.discountCode.findUnique({ where: { code: normalized } });
    if (!discountCode || !discountCode.active) {
      throw new BadRequestException('Invalid discount code');
    }
    if (discountCode.expiresAt && discountCode.expiresAt < new Date()) {
      throw new BadRequestException('This discount code has expired');
    }

    const [totalRedemptions, userRedemptions] = await Promise.all([
      discountCode.maxRedemptions != null
        ? this.prisma.discountCodeRedemption.count({ where: { discountCodeId: discountCode.id } })
        : Promise.resolve(0),
      this.prisma.discountCodeRedemption.count({ where: { discountCodeId: discountCode.id, userId } }),
    ]);
    if (discountCode.maxRedemptions != null && totalRedemptions >= discountCode.maxRedemptions) {
      throw new BadRequestException('This discount code has reached its redemption limit');
    }
    if (userRedemptions >= discountCode.maxRedemptionsPerUser) {
      throw new BadRequestException("You've already used this discount code");
    }

    return { id: discountCode.id, discountPercent: discountCode.discountPercent };
  }

  private applyDiscount(amountPaise: number, discountPercent: number | undefined): number {
    if (!discountPercent) return amountPaise;
    return Math.round((amountPaise * (100 - discountPercent)) / 100);
  }

  async createBoostOrder(
    userId: string,
    listingId: string,
    boostDays: BoostDurationDays,
    discountCode?: string,
    includeInstantAlerts = false,
    context: PurchaseContext = {},
  ): Promise<CreateBoostOrderResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

    // The free monthly Agent Pro credit only ever covers the boost itself — bundling in Instant
    // Alerts means real money changes hands regardless, so the bundle skips this shortcut
    // entirely rather than deciding how to split a ₹0 boost from a paid add-on.
    if (boostDays === 7 && !includeInstantAlerts) {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { agentProUntil: true },
      });
      const isPro = (owner?.agentProUntil?.getTime() ?? 0) > Date.now();
      if (isPro) {
        const monthKey = utcMonthKey();
        const credit = await this.prisma.proBoostCredit.findUnique({
          where: { userId_monthKey: { userId, monthKey } },
        });
        if (credit && !credit.redeemedAt) {
          const payment = await this.prisma.payment.create({
            data: {
              userId,
              razorpayOrderId: `pro_credit_${userId}_${Date.now()}`,
              amount: 0,
              currency: 'INR',
              purpose: 'listing_boost',
              listingId,
              boostDays,
              status: 'paid',
              paidAt: new Date(),
            },
          });
          await this.activateListingBoost(listingId, boostDays, payment.id);
          await this.prisma.proBoostCredit.update({
            where: { id: credit.id },
            data: { redeemedAt: new Date(), listingId },
          });
          return {
            paymentId: payment.id,
            amount: 0,
            currency: 'INR',
            activated: true,
          };
        }
      }
    }

    const discount = await this.resolveDiscountCode(discountCode, userId);
    const boostPriceSettings =
      (await this.prisma.boostPriceSetting.findUnique({ where: { id: BOOST_PRICE_SETTINGS_ID } })) ??
      DEFAULT_BOOST_PRICE_SETTINGS;
    const instantAlertsPriceSettings = includeInstantAlerts
      ? ((await this.prisma.instantAlertsPriceSetting.findUnique({ where: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID } })) ??
        DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS)
      : null;
    const baseRupees =
      boostPriceFor(listing.category, boostDays, boostPriceSettings) + (instantAlertsPriceSettings?.instantAlertsPrice ?? 0);
    const amountInPaise = this.applyDiscount(baseRupees * 100, discount?.discountPercent);

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `boost_${listingId}_${Date.now()}`,
      notes: { purpose: 'listing_boost', listingId, boostDays: String(boostDays), includeInstantAlerts: String(includeInstantAlerts) },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        purpose: 'listing_boost',
        listingId,
        boostDays,
        boostIncludesInstantAlerts: includeInstantAlerts,
        discountCodeId: discount?.id,
        ...context,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? '',
      amount: amountInPaise,
      currency: 'INR',
    };
  }

  /** Every price the post-ad success screen's Boost/Instant Alerts picker needs, in one call —
   * rupees, not paise (display only; `createBoostOrder` is the source of truth for what actually
   * gets charged). `discountCode` is resolved the same way `createBoostOrder` does, except a
   * bad/expired/exhausted code degrades to "no discount" here rather than throwing: this is a
   * preview a page renders on load, not a checkout the seller explicitly submitted, so an
   * auto-applied promo that's gone stale should just silently fall back to full price instead of
   * failing the whole screen. */
  async previewBoostPricing(userId: string, category: ListingCategory, discountCode?: string): Promise<BoostPricingPreviewDto> {
    const [boostPriceSettingsRow, instantAlertsPriceSettingsRow, owner] = await Promise.all([
      this.prisma.boostPriceSetting.findUnique({ where: { id: BOOST_PRICE_SETTINGS_ID } }),
      this.prisma.instantAlertsPriceSetting.findUnique({ where: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { agentProUntil: true } }),
    ]);
    const boostPriceSettings = boostPriceSettingsRow ?? DEFAULT_BOOST_PRICE_SETTINGS;
    const instantAlertsPriceSettings = instantAlertsPriceSettingsRow ?? DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS;

    let discountPercent: number | undefined;
    try {
      const discount = await this.resolveDiscountCode(discountCode, userId);
      discountPercent = discount?.discountPercent;
    } catch {
      discountPercent = undefined;
    }

    // Same free-credit check createBoostOrder makes, so this preview never shows a price the
    // actual checkout wouldn't charge — only ever applies to the boost-alone 7-day option, per
    // createBoostOrder's own reasoning for why the bundle skips this shortcut.
    const isPro = (owner?.agentProUntil?.getTime() ?? 0) > Date.now();
    let hasFreeBoostCredit = false;
    if (isPro) {
      const credit = await this.prisma.proBoostCredit.findUnique({
        where: { userId_monthKey: { userId, monthKey: utcMonthKey() } },
      });
      hasFreeBoostCredit = !!credit && !credit.redeemedAt;
    }

    const boost7Rupees = boostPriceFor(category, 7, boostPriceSettings);
    const boost15Rupees = boostPriceFor(category, 15, boostPriceSettings);
    const alertsRupees = instantAlertsPriceSettings.instantAlertsPrice;

    const option = (baseRupees: number, free: boolean): BoostPricingOptionDto => {
      if (free) return { amount: 0, originalAmount: 0, discountApplied: false, free: true };
      const amount = discountPercent ? Math.round((baseRupees * (100 - discountPercent)) / 100) : baseRupees;
      return { amount, originalAmount: baseRupees, discountApplied: !!discountPercent, free: false };
    };

    return {
      boost7: option(boost7Rupees, hasFreeBoostCredit),
      boost15: option(boost15Rupees, false),
      boost7WithInstantAlerts: option(boost7Rupees + alertsRupees, false),
      boost15WithInstantAlerts: option(boost15Rupees + alertsRupees, false),
      showSelectorOnPreview: boostPriceSettings.showSelectorOnPreview,
    };
  }

  /** No seller-chosen duration and no free-credit short-circuit (unlike createBoostOrder) —
   * Instant Alerts is a flat fee that always runs until the listing's own expiresAt, resolved
   * fresh at webhook time in activateInstantAlerts, not here. */
  async createInstantAlertsOrder(
    userId: string,
    listingId: string,
    discountCode?: string,
    context: PurchaseContext = {},
  ): Promise<CreateInstantAlertsOrderResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

    const discount = await this.resolveDiscountCode(discountCode, userId);
    const instantAlertsPriceSettings =
      (await this.prisma.instantAlertsPriceSetting.findUnique({ where: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID } })) ??
      DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS;
    const amountInPaise = this.applyDiscount(
      instantAlertsPriceSettings.instantAlertsPrice * 100,
      discount?.discountPercent,
    );

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `instant_alerts_${listingId}_${Date.now()}`,
      notes: { purpose: 'instant_alerts', listingId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        purpose: 'instant_alerts',
        listingId,
        discountCodeId: discount?.id,
        ...context,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? '',
      amount: amountInPaise,
      currency: 'INR',
    };
  }

  async createListingPublishOrder(
    userId: string,
    listingId: string,
    boostDays?: BoostDurationDays,
    includeInstantAlerts = false,
    discountCode?: string,
    context: PurchaseContext = {},
  ): Promise<CreateListingPublishOrderResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");
    if (listing.publishState !== 'pending_checkout') {
      throw new BadRequestException('This listing is not awaiting publish checkout');
    }
    if (includeInstantAlerts && !boostDays) {
      throw new BadRequestException('Instant Alerts requires a Boost selection at publish time');
    }

    const [platformFeeSettings, boostPriceSettings, instantAlertsPriceSettings] = await Promise.all([
      this.prisma.platformFeeSetting.findUnique({ where: { id: PLATFORM_FEE_SETTINGS_ID } }),
      this.prisma.boostPriceSetting.findUnique({ where: { id: BOOST_PRICE_SETTINGS_ID } }),
      includeInstantAlerts
        ? this.prisma.instantAlertsPriceSetting.findUnique({ where: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID } })
        : Promise.resolve(null),
    ]);
    const feeRupees = platformFeeFor(listing.category, platformFeeSettings ?? undefined);
    let boostRupees = 0;
    if (boostDays) {
      boostRupees =
        boostPriceFor(listing.category, boostDays, boostPriceSettings ?? DEFAULT_BOOST_PRICE_SETTINGS) +
        (includeInstantAlerts
          ? (instantAlertsPriceSettings ?? DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS).instantAlertsPrice
          : 0);
    }
    if (feeRupees === 0 && !boostDays) {
      throw new BadRequestException('Nothing to charge for this listing');
    }

    const discount = await this.resolveDiscountCode(discountCode, userId);

    let proCreditRedeem:
      | { id: string }
      | null = null;
    if (boostDays === 7 && !includeInstantAlerts && boostRupees > 0) {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { agentProUntil: true },
      });
      const isPro = (owner?.agentProUntil?.getTime() ?? 0) > Date.now();
      if (isPro) {
        const monthKey = utcMonthKey();
        const credit = await this.prisma.proBoostCredit.findUnique({
          where: { userId_monthKey: { userId, monthKey } },
        });
        if (credit && !credit.redeemedAt) {
          proCreditRedeem = { id: credit.id };
          boostRupees = 0;
        }
      }
    }

    // Promo codes apply to Boost / Instant Alerts only — platform fee is always charged in full.
    const amountInPaise =
      feeRupees * 100 + this.applyDiscount(boostRupees * 100, discount?.discountPercent);

    if (amountInPaise === 0) {
      const payment = await this.prisma.payment.create({
        data: {
          userId,
          razorpayOrderId: `listing_publish_${listingId}_${Date.now()}`,
          amount: 0,
          currency: 'INR',
          purpose: 'listing_publish',
          listingId,
          boostDays: boostDays ?? null,
          boostIncludesInstantAlerts: includeInstantAlerts,
          discountCodeId: discount?.id,
          status: 'paid',
          paidAt: new Date(),
          ...context,
        },
      });
      if (discount?.id) {
        await this.prisma.discountCodeRedemption.create({
          data: { discountCodeId: discount.id, userId, paymentId: payment.id },
        });
      }
      if (proCreditRedeem) {
        await this.prisma.proBoostCredit.update({
          where: { id: proCreditRedeem.id },
          data: { redeemedAt: new Date(), listingId },
        });
      }
      await this.fulfillListingPublishPayment(payment);
      return {
        paymentId: payment.id,
        amount: 0,
        currency: 'INR',
        activated: true,
      };
    }

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `lpub_${listingId}_${Date.now()}`,
      notes: {
        purpose: 'listing_publish',
        listingId,
        boostDays: boostDays ? String(boostDays) : '',
        includeInstantAlerts: String(includeInstantAlerts),
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        purpose: 'listing_publish',
        listingId,
        boostDays: boostDays ?? null,
        boostIncludesInstantAlerts: includeInstantAlerts,
        discountCodeId: discount?.id,
        ...context,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? '',
      amount: amountInPaise,
      currency: 'INR',
    };
  }

  private async tryRedeemProBoostCreditForListing(userId: string, listingId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { agentProUntil: true },
    });
    const isPro = (owner?.agentProUntil?.getTime() ?? 0) > Date.now();
    if (!isPro) return;
    const monthKey = utcMonthKey();
    const credit = await this.prisma.proBoostCredit.findUnique({
      where: { userId_monthKey: { userId, monthKey } },
    });
    if (!credit || credit.redeemedAt) return;
    await this.prisma.proBoostCredit.update({
      where: { id: credit.id },
      data: { redeemedAt: new Date(), listingId },
    });
  }

  private async fulfillListingPublishPayment(payment: {
    id: string;
    userId: string;
    listingId: string | null;
    boostDays: number | null;
    boostIncludesInstantAlerts: boolean;
    adsTrackingAuthorized: boolean | null;
  }): Promise<void> {
    if (!payment.listingId) return;
    await this.listingsService.completePendingPublish(
      payment.listingId,
      payment.adsTrackingAuthorized ?? undefined,
    );
    if (payment.boostDays) {
      if (payment.boostDays === 7 && !payment.boostIncludesInstantAlerts) {
        await this.tryRedeemProBoostCreditForListing(payment.userId, payment.listingId);
      }
      await this.activateListingBoost(payment.listingId, payment.boostDays, payment.id);
      if (payment.boostIncludesInstantAlerts) {
        await this.activateInstantAlerts(payment.listingId, payment.id);
        this.notifyBoostAndInstantAlertsActivated(payment.listingId, payment.boostDays);
      } else {
        this.notifyListingBoostActivated(payment.listingId, payment.boostDays);
      }
    }
  }

  async createSubscriptionOrder(
    userId: string,
    tier: SubscriptionTier,
    months: number,
    agentProUnits = 1,
    discountCode?: string,
    context: PurchaseContext = {},
  ): Promise<CreateSubscriptionOrderResponseDto> {
    if (tier === 'agentPro') {
      if (months !== 1) throw new BadRequestException('Agent/Broker Pro is available as a monthly subscription only');
    } else if (tier === 'sellerSlotPack') {
      if (months !== 1) throw new BadRequestException('Seller slot pack is monthly only');
    }

    const units = tier === 'agentPro' ? Math.max(1, Math.min(agentProUnits, 20)) : 1;
    const discount = await this.resolveDiscountCode(discountCode, userId);
    const subscriptionPlanSettings =
      (await this.prisma.subscriptionPlanSetting.findUnique({ where: { id: SUBSCRIPTION_PLAN_SETTINGS_ID } })) ??
      DEFAULT_SUBSCRIPTION_PLAN_SETTINGS;
    const amountInPaise = this.applyDiscount(
      subscriptionPriceFor(tier, months, units, subscriptionPlanSettings) * 100,
      discount?.discountPercent,
    );
    const purpose =
      tier === 'buyerPremium' ? 'buyer_premium' : tier === 'agentPro' ? 'agent_pro' : 'seller_slot_pack';

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `${purpose}_${userId}_${Date.now()}`,
      notes: { purpose, tier, months: String(months), agentProUnits: String(units) },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        purpose,
        subscriptionMonths: months,
        agentProUnits: tier === 'agentPro' ? units : null,
        discountCodeId: discount?.id,
        ...context,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? '',
      amount: amountInPaise,
      currency: 'INR',
    };
  }

  /** Pack size/price are never client-supplied — always read from the current
   * ContactRevealSetting row (or its defaults, if no admin has saved it yet), same
   * find-or-fallback style as RateLimitService.getSettings, just inlined here rather than via a
   * cross-module service call — this file's other create*Order methods are all direct-Prisma. */
  async createContactRevealCreditsOrder(
    userId: string,
    discountCode?: string,
    context: PurchaseContext = {},
  ): Promise<CreateContactRevealCreditsOrderResponseDto> {
    const settings =
      (await this.prisma.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ??
      DEFAULT_CONTACT_REVEAL_SETTINGS;

    const discount = await this.resolveDiscountCode(discountCode, userId);
    const amountInPaise = this.applyDiscount(settings.creditPackPriceRupees * 100, discount?.discountPercent);

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      // Razorpay caps `receipt` at 56 chars — `contact_reveal_credits_<cuid>_<ms>` is 62 and
      // gets rejected with input_validation_failed. Keep this prefix short; the full purpose is
      // already on `notes` and the Payment row.
      receipt: `crc_${userId}_${Date.now()}`,
      notes: { purpose: 'contact_reveal_credits', creditPackSize: String(settings.creditPackSize) },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        purpose: 'contact_reveal_credits',
        creditPackSize: settings.creditPackSize,
        discountCodeId: discount?.id,
        ...context,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? '',
      amount: amountInPaise,
      currency: 'INR',
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
    if (!signature || !Razorpay.validateWebhookSignature(rawBody.toString(), signature, secret)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString()) as RazorpayWebhookPayload;
    if (event.event !== 'payment.captured') return;

    const { id: razorpayPaymentId, order_id: razorpayOrderId } = event.payload.payment.entity;

    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown order ${razorpayOrderId} — ignoring`);
      return;
    }
    if (payment.status === 'paid') return;

    const paidAt = new Date();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'paid', razorpayPaymentId, paidAt },
    });

    // Reported here rather than from a browser tag, because the browser is not where most of
    // these happen: nine boost purchases from google/cpc clicks, every one with a gclid on file,
    // were recorded by Google Ads as zero conversions. Fire-and-forget, and after the row is
    // already marked paid — a reporting call must never delay or fail an activation.
    void this.reportPurchaseConversion({ ...payment, paidAt });

    if (payment.purpose === 'listing_publish' && payment.listingId) {
      await this.fulfillListingPublishPayment(payment);
      this.logger.log(`Listing publish fulfilled for ${payment.listingId}`);
    }

    if (payment.purpose === 'listing_boost' && payment.listingId && payment.boostDays) {
      await this.activateListingBoost(payment.listingId, payment.boostDays, payment.id);
      this.logger.log(`Boost activated for listing ${payment.listingId}`);
      if (payment.boostIncludesInstantAlerts) {
        await this.activateInstantAlerts(payment.listingId, payment.id);
        this.logger.log(`Instant Alerts activated for listing ${payment.listingId} (bundled with boost)`);
        this.notifyBoostAndInstantAlertsActivated(payment.listingId, payment.boostDays);
      } else {
        this.notifyListingBoostActivated(payment.listingId, payment.boostDays);
      }
    }

    if (payment.purpose === 'instant_alerts' && payment.listingId) {
      await this.activateInstantAlerts(payment.listingId, payment.id);
      this.logger.log(`Instant Alerts activated for listing ${payment.listingId}`);
      this.notifyInstantAlertsActivated(payment.listingId);
    }

    if (payment.purpose === 'buyer_premium' && payment.subscriptionMonths) {
      const endsAt = new Date(Date.now() + payment.subscriptionMonths * 30 * 24 * 60 * 60 * 1000);
      await this.prisma.userSubscription.create({
        data: { userId: payment.userId, tier: 'buyerPremium', endsAt, paymentId: payment.id },
      });
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { premiumUntil: endsAt },
      });
      this.logger.log(`buyerPremium activated for user ${payment.userId} until ${endsAt.toISOString()}`);
      this.notifyUserPurchaseActivated(payment.userId, 'buyer_premium_activated', (user) =>
        this.notificationsService.notifyBuyerPremiumActivated(user, endsAt),
      );
    }

    if (payment.purpose === 'seller_slot_pack' && payment.subscriptionMonths) {
      const endsAt = new Date(Date.now() + payment.subscriptionMonths * 30 * 24 * 60 * 60 * 1000);
      await this.prisma.userSubscription.create({
        data: { userId: payment.userId, tier: 'sellerSlotPack', endsAt, paymentId: payment.id },
      });
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { sellerSlotPackUntil: endsAt },
      });
      this.logger.log(`sellerSlotPack activated for user ${payment.userId} until ${endsAt.toISOString()}`);
      const sellerSlotPackSettings =
        (await this.prisma.subscriptionPlanSetting.findUnique({ where: { id: SUBSCRIPTION_PLAN_SETTINGS_ID } })) ??
        DEFAULT_SUBSCRIPTION_PLAN_SETTINGS;
      this.notifyUserPurchaseActivated(payment.userId, 'seller_slot_pack_activated', (user) =>
        this.notificationsService.notifySellerSlotPackActivated(user, endsAt, sellerSlotPackSettings.sellerSlotPackTotalSlots),
      );
    }

    if (payment.purpose === 'agent_pro' && payment.subscriptionMonths) {
      const endsAt = new Date(Date.now() + payment.subscriptionMonths * 30 * 24 * 60 * 60 * 1000);
      const units = Math.max(1, payment.agentProUnits ?? 1);
      await this.prisma.userSubscription.create({
        data: { userId: payment.userId, tier: 'agentPro', endsAt, paymentId: payment.id },
      });
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: { agentProUntil: endsAt, agentProUnits: units },
      });
      await this.ensureProBoostCreditForMonth(payment.userId);
      this.logger.log(`agentPro (${units} units) for user ${payment.userId} until ${endsAt.toISOString()}`);
      const agentProSettings =
        (await this.prisma.subscriptionPlanSetting.findUnique({ where: { id: SUBSCRIPTION_PLAN_SETTINGS_ID } })) ??
        DEFAULT_SUBSCRIPTION_PLAN_SETTINGS;
      this.notifyUserPurchaseActivated(payment.userId, 'agent_pro_activated', (user) =>
        this.notificationsService.notifyAgentProActivated(user, endsAt, units * agentProSettings.proListingSlotsPerUnit),
      );
    }

    if (payment.purpose === 'contact_reveal_credits' && payment.creditPackSize) {
      const settings =
        (await this.prisma.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ??
        DEFAULT_CONTACT_REVEAL_SETTINGS;
      const expiresAt = new Date(Date.now() + settings.creditExpiryMonths * 30 * 24 * 60 * 60 * 1000);
      await this.prisma.contactRevealCreditBatch.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          creditsGranted: payment.creditPackSize,
          creditsRemaining: payment.creditPackSize,
          expiresAt,
        },
      });
      this.logger.log(`${payment.creditPackSize} contact-reveal credits granted to user ${payment.userId}, expiring ${expiresAt.toISOString()}`);
      this.notifyUserPurchaseActivated(payment.userId, 'contact_reveal_credits_activated', (user) =>
        this.notificationsService.notifyContactRevealCreditsActivated(user, payment.creditPackSize as number, expiresAt),
      );
    }

    // Applies to every purpose above, not just one — a discount code is redeemable across all
    // paid products. Created only now (payment confirmed paid), never at order-creation, so an
    // abandoned checkout never consumes a redemption slot.
    if (payment.discountCodeId) {
      await this.prisma.discountCodeRedemption.create({
        data: { discountCodeId: payment.discountCodeId, userId: payment.userId, paymentId: payment.id },
      });
    }
  }

  /** A user's own purchase history, every purpose in one feed — see PaymentHistoryItemDto's own
   * doc comment for why. Newest first, cursor-paginated (same shape as ListingsService.
   * listForAdmin: `take: limit + 1` to know if there's another page, without a separate count
   * query). Includes every status (created/failed/refunded, not just paid) — an abandoned or
   * failed checkout is still something the user attempted and might reasonably wonder about,
   * not something to hide. */
  async listForUser(userId: string, cursor?: string, limit = 20): Promise<PaymentHistoryPage> {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      include: { listing: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((p) => ({
        id: p.id,
        purpose: p.purpose,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        ...(p.listingId ? { listingId: p.listingId, listingTitle: p.listing?.title } : {}),
        ...(p.boostDays ? { boostDays: p.boostDays } : {}),
        ...(p.subscriptionMonths ? { subscriptionMonths: p.subscriptionMonths } : {}),
        ...(p.agentProUnits ? { agentProUnits: p.agentProUnits } : {}),
        ...(p.creditPackSize ? { creditPackSize: p.creditPackSize } : {}),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
