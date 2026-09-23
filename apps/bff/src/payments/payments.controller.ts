import { Body, Controller, Get, HttpCode, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type {
  BoostPricingPreviewDto,
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateInstantAlertsOrderResponseDto,
  CreateListingPublishOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
} from '@bhavano/types';
import { CreateListingPublishOrderDto } from './dto/create-listing-publish-order.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { PaymentsService } from './payments.service';
import { parseTrackingAuthorized } from '../ads/tracking-authorized';
import { CreateBoostOrderDto } from './dto/create-boost-order.dto';
import { CreateSubscriptionOrderDto } from './dto/create-subscription-order.dto';
import { CreateContactRevealCreditsOrderDto } from './dto/create-contact-reveal-credits-order.dto';
import { CreateInstantAlertsOrderDto } from './dto/create-instant-alerts-order.dto';
import { PreviewBoostPricingDto } from './dto/preview-boost-pricing.dto';

/** What the order needs to remember about the client for the sake of the conversion upload that
 * happens much later, in a webhook with none of this context: whether ad tracking was allowed
 * (iOS ATT — see ads/tracking-authorized.ts) and which client the purchase was made from.
 * `x-client` is absent from every mobile build shipped before it existed, so null means unknown
 * rather than web. */
function purchaseContext(trackingHeader?: string, clientHeader?: string): {
  adsTrackingAuthorized?: boolean;
  platform?: string;
} {
  const authorized = parseTrackingAuthorized(trackingHeader);
  return {
    ...(authorized === false ? { adsTrackingAuthorized: false } : {}),
    ...(clientHeader === 'app' || clientHeader === 'web' ? { platform: clientHeader } : {}),
  };
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders')
  @UseGuards(AuthGuard)
  createOrder(
    @Body() dto: CreateBoostOrderDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-tracking-authorized') tracking?: string,
    @Headers('x-client') client?: string,
  ): Promise<CreateBoostOrderResponseDto> {
    return this.paymentsService.createBoostOrder(
      user.id,
      dto.listingId,
      dto.boostDays,
      dto.discountCode,
      dto.includeInstantAlerts,
      purchaseContext(tracking, client),
    );
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
    @Headers('x-tracking-authorized') tracking?: string,
    @Headers('x-client') client?: string,
  ): Promise<CreateSubscriptionOrderResponseDto> {
    return this.paymentsService.createSubscriptionOrder(
      user.id,
      dto.tier,
      dto.months,
      dto.agentProUnits,
      dto.discountCode,
      purchaseContext(tracking, client),
    );
  }

  @Post('listing-publish-order')
  @UseGuards(AuthGuard)
  createListingPublishOrder(
    @Body() dto: CreateListingPublishOrderDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-tracking-authorized') tracking?: string,
    @Headers('x-client') client?: string,
  ): Promise<CreateListingPublishOrderResponseDto> {
    return this.paymentsService.createListingPublishOrder(
      user.id,
      dto.listingId,
      dto.boostDays,
      dto.includeInstantAlerts,
      dto.discountCode,
      purchaseContext(tracking, client),
    );
  }

  @Post('instant-alerts')
  @UseGuards(AuthGuard)
  createInstantAlertsOrder(
    @Body() dto: CreateInstantAlertsOrderDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-tracking-authorized') tracking?: string,
    @Headers('x-client') client?: string,
  ): Promise<CreateInstantAlertsOrderResponseDto> {
    return this.paymentsService.createInstantAlertsOrder(
      user.id,
      dto.listingId,
      dto.discountCode,
      purchaseContext(tracking, client),
    );
  }

  @Post('contact-reveal-credits')
  @UseGuards(AuthGuard)
  createContactRevealCreditsOrder(
    @Body() dto: CreateContactRevealCreditsOrderDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-tracking-authorized') tracking?: string,
    @Headers('x-client') client?: string,
  ): Promise<CreateContactRevealCreditsOrderResponseDto> {
    return this.paymentsService.createContactRevealCreditsOrder(
      user.id,
      dto.discountCode,
      purchaseContext(tracking, client),
    );
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
