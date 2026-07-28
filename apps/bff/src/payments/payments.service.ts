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
import type { CreateBoostOrderResponseDto, CreateSubscriptionOrderResponseDto, SubscriptionTier } from '@bhavano/types';
import { boostPriceFor, type BoostDurationDays } from '@bhavano/types/boostPricing';
import { subscriptionPriceFor } from '@bhavano/types/subscriptionPricing';
import { PrismaService } from '../prisma/prisma.service';

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

  async createBoostOrder(userId: string, listingId: string, boostDays: BoostDurationDays): Promise<CreateBoostOrderResponseDto> {
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

    const amountInPaise = boostPriceFor(listing.category, boostDays) * 100;

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
  ): Promise<CreateSubscriptionOrderResponseDto> {
    if (tier === 'agentPro') {
      if (months !== 1) throw new BadRequestException('Agent/Broker Pro is available as a monthly subscription only');
    } else if (tier === 'sellerSlotPack') {
      if (months !== 1) throw new BadRequestException('Seller slot pack is monthly only');
    }

    const units = tier === 'agentPro' ? Math.max(1, Math.min(agentProUnits, 20)) : 1;
    const amountInPaise = subscriptionPriceFor(tier, months, units) * 100;
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
  }
}
