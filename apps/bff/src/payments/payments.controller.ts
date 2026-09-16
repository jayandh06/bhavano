import { Body, Controller, Get, HttpCode, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type {
  BoostPricingPreviewDto,
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateInstantAlertsOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
} from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { PaymentsService } from './payments.service';
import { CreateBoostOrderDto } from './dto/create-boost-order.dto';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';
import { CreateContactRevealCreditsOrderDto } from './dto/create-contact-reveal-credits-order.dto';
import { CreateInstantAlertsOrderDto } from './dto/create-instant-alerts-order.dto';
import { PreviewBoostPricingDto } from './dto/preview-boost-pricing.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders')
  @UseGuards(AuthGuard)
  createOrder(@Body() dto: CreateBoostOrderDto, @CurrentUser() user: RequestUser): Promise<CreateBoostOrderResponseDto> {
    return this.paymentsService.createBoostOrder(user.id, dto.listingId, dto.boostDays, dto.discountCode, dto.includeInstantAlerts);
  }

  @Get('boost-pricing-preview')
  @UseGuards(AuthGuard)
  previewBoostPricing(
    @Query() dto: PreviewBoostPricingDto,
    @CurrentUser() user: RequestUser,
  ): Promise<BoostPricingPreviewDto> {
    return this.paymentsService.previewBoostPricing(user.id, dto.category, dto.discountCode);
  }

  @Post('subscriptions')
  @UseGuards(AuthGuard)
  createSubscriptionOrder(
    @Body() dto: CreateSubscriptionOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateSubscriptionOrderResponseDto> {
    return this.paymentsService.createSubscriptionOrder(user.id, dto.tier, dto.months, dto.agentProUnits, dto.discountCode);
  }

  @Post('instant-alerts')
  @UseGuards(AuthGuard)
  createInstantAlertsOrder(
    @Body() dto: CreateInstantAlertsOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateInstantAlertsOrderResponseDto> {
    return this.paymentsService.createInstantAlertsOrder(user.id, dto.listingId, dto.discountCode);
  }

  @Post('contact-reveal-credits')
  @UseGuards(AuthGuard)
  createContactRevealCreditsOrder(
    @Body() dto: CreateContactRevealCreditsOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateContactRevealCreditsOrderResponseDto> {
    return this.paymentsService.createContactRevealCreditsOrder(user.id, dto.discountCode);
  }

  /** Public (no AuthGuard) — Razorpay calls this server-to-server, authenticated by HMAC
   * signature instead of a Bearer token. Needs the exact raw body (see main.ts's
   * `rawBody: true`), not the JSON-parsed one, to verify that signature. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string): Promise<{ success: true }> {
    await this.paymentsService.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
    return { success: true };
  }
}
