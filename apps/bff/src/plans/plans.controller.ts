import { Controller, Get } from '@nestjs/common';
import type { BoostPriceSettings } from '@bhavano/types/boostPricing';
import type { SubscriptionPlanSettings } from '@bhavano/types/subscriptionPricing';
import type { InstantAlertsPriceSettings } from '@bhavano/types/instantAlertsPricing';
import { ACTIVE_PROMO_CODE } from '@bhavano/types/promoCode';
import { PrismaService } from '../prisma/prisma.service';
import { BoostPricingSettingsService } from './boost-pricing-settings.service';
import { SubscriptionPlanSettingsService } from './subscription-plan-settings.service';
import { InstantAlertsPricingSettingsService } from './instant-alerts-pricing-settings.service';

/** Public, no AdminGuard — a logged-out visitor browsing the pricing page or the boost picker
 * needs to see current prices too, same precedent as LocationsController and
 * GET /listings/contact-reveal-settings. Never trust these values back from a client at checkout
 * time: PaymentsService re-reads the same rows directly server-side. See
 * docs/plans/admin-manage-plans-pricing.md. */
@Controller('plans')
export class PlansController {
  constructor(
    private readonly boostPricingSettingsService: BoostPricingSettingsService,
    private readonly subscriptionPlanSettingsService: SubscriptionPlanSettingsService,
    private readonly instantAlertsPricingSettingsService: InstantAlertsPricingSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('pricing')
  async getPricing(): Promise<{
    boost: BoostPriceSettings;
    subscription: SubscriptionPlanSettings;
    instantAlerts: InstantAlertsPriceSettings;
    activeDiscountPercent: number | null;
  }> {
    const [boost, subscription, instantAlerts, activeDiscountPercent] = await Promise.all([
      this.boostPricingSettingsService.getSettings(),
      this.subscriptionPlanSettingsService.getSettings(),
      this.instantAlertsPricingSettingsService.getSettings(),
      this.getActiveDiscountPercent(),
    ]);
    return { boost, subscription, instantAlerts, activeDiscountPercent };
  }

  /** The percent off `ACTIVE_PROMO_CODE` currently gives, or `null` if it isn't usable right now
   * (inactive, expired, or its total redemption cap is already spent) — for display only, before
   * login, on the ad-preview step's boost/instant-alerts selector. Deliberately checks only the
   * *total* redemption cap, not PaymentsService.resolveDiscountCode's per-user one: there is no
   * user yet at this point, and per-user eligibility only ever matters at actual checkout time,
   * which re-resolves the code itself and is the sole authority on what gets charged. */
  private async getActiveDiscountPercent(): Promise<number | null> {
    const discountCode = await this.prisma.discountCode.findUnique({ where: { code: ACTIVE_PROMO_CODE } });
    if (!discountCode || !discountCode.active) return null;
    if (discountCode.expiresAt && discountCode.expiresAt < new Date()) return null;
    if (discountCode.maxRedemptions != null) {
      const totalRedemptions = await this.prisma.discountCodeRedemption.count({
        where: { discountCodeId: discountCode.id },
      });
      if (totalRedemptions >= discountCode.maxRedemptions) return null;
    }
    return discountCode.discountPercent;
  }
}
