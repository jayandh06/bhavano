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
import type { CreateBoostOrderResponseDto } from '@bhavano/types';
import { boostPriceFor, type BoostDurationDays } from '@bhavano/types/boostPricing';
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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  // Lazily constructed — the Razorpay SDK throws synchronously if key_id/key_secret are blank,
  // which would otherwise crash the *entire* BFF at boot (Nest eagerly instantiates every
  // provider), not just the payments feature, on any environment without real Razorpay
  // credentials configured yet (e.g. local dev). Constructed on first real use instead, so a
  // missing third-party API key only fails the one request that actually needs it.
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

  /** Creates a Razorpay order for boosting a listing — the order isn't "paid" until the
   * webhook below confirms it, this just gives the frontend what it needs to open Checkout. */
  async createBoostOrder(userId: string, listingId: string, boostDays: BoostDurationDays): Promise<CreateBoostOrderResponseDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

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

  /** The only source of truth for a boost actually being paid for — never a client-side
   * "payment succeeded" callback. Idempotent: Razorpay redelivers webhooks, and the `status
   * === 'paid'` check below (checked before any write) makes a redelivery a safe no-op.
   * Only handles `payment.captured` for now — refund/failure events aren't acted on yet
   * (Phase 1 scope, see docs/plans/monetization-boosted-listings-premium-tiers.md). */
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
      const boostedUntil = new Date(Date.now() + payment.boostDays * 24 * 60 * 60 * 1000);
      await this.prisma.listingBoost.create({
        data: { listingId: payment.listingId, paymentId: payment.id, boostedUntil },
      });
      await this.prisma.listing.update({
        where: { id: payment.listingId },
        data: { boostedUntil, boostRank: Math.random() },
      });
      this.logger.log(`Boost activated for listing ${payment.listingId} until ${boostedUntil.toISOString()}`);
    }
  }
}
