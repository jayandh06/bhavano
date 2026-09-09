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
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
  PaymentHistoryPage,
  SubscriptionTier,
} from '@bhavano/types';
import { boostPriceFor, type BoostDurationDays } from '@bhavano/types/boostPricing';
import { subscriptionPriceFor } from '@bhavano/types/subscriptionPricing';
import { PrismaService } from '../prisma/prisma.service';
import { CONTACT_REVEAL_SETTINGS_ID, DEFAULT_CONTACT_REVEAL_SETTINGS } from '../contact-reveal/contact-reveal.constants';

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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
  ): Promise<CreateBoostOrderResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

    if (boostDays === 7) {
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
    const amountInPaise = this.applyDiscount(boostPriceFor(listing.category, boostDays) * 100, discount?.discountPercent);

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `boost_${listingId}_${Date.now()}`,
      notes: { purpose: 'listing_boost', listingId, boostDays: String(boostDays) },
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
        discountCodeId: discount?.id,
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

  async createSubscriptionOrder(
    userId: string,
    tier: SubscriptionTier,
    months: number,
    agentProUnits = 1,
    discountCode?: string,
  ): Promise<CreateSubscriptionOrderResponseDto> {
    if (tier === 'agentPro') {
      if (months !== 1) throw new BadRequestException('Agent/Broker Pro is available as a monthly subscription only');
    } else if (tier === 'sellerSlotPack') {
      if (months !== 1) throw new BadRequestException('Seller slot pack is monthly only');
    }

    const units = tier === 'agentPro' ? Math.max(1, Math.min(agentProUnits, 20)) : 1;
    const discount = await this.resolveDiscountCode(discountCode, userId);
    const amountInPaise = this.applyDiscount(subscriptionPriceFor(tier, months, units) * 100, discount?.discountPercent);
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
  ): Promise<CreateContactRevealCreditsOrderResponseDto> {
    const settings =
      (await this.prisma.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ??
      DEFAULT_CONTACT_REVEAL_SETTINGS;

    const discount = await this.resolveDiscountCode(discountCode, userId);
    const amountInPaise = this.applyDiscount(settings.creditPackPriceRupees * 100, discount?.discountPercent);

    const order = await this.getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `contact_reveal_credits_${userId}_${Date.now()}`,
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

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'paid', razorpayPaymentId, paidAt: new Date() },
    });

    if (payment.purpose === 'listing_boost' && payment.listingId && payment.boostDays) {
      await this.activateListingBoost(payment.listingId, payment.boostDays, payment.id);
      this.logger.log(`Boost activated for listing ${payment.listingId}`);
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
