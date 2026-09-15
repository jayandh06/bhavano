import { Controller, Get } from '@nestjs/common';
import type { BoostPriceSettings } from '@bhavano/types/boostPricing';
import type { SubscriptionPlanSettings } from '@bhavano/types/subscriptionPricing';
import type { InstantAlertsPriceSettings } from '@bhavano/types/instantAlertsPricing';
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
  ) {}

  @Get('pricing')
  async getPricing(): Promise<{
    boost: BoostPriceSettings;
    subscription: SubscriptionPlanSettings;
    instantAlerts: InstantAlertsPriceSettings;
  }> {
    const [boost, subscription, instantAlerts] = await Promise.all([
      this.boostPricingSettingsService.getSettings(),
      this.subscriptionPlanSettingsService.getSettings(),
      this.instantAlertsPricingSettingsService.getSettings(),
    ]);
    return { boost, subscription, instantAlerts };
  }
}
