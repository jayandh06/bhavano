import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { BoostPricingSettingsService } from './boost-pricing-settings.service';
import { SubscriptionPlanSettingsService } from './subscription-plan-settings.service';
import { InstantAlertsPricingSettingsService } from './instant-alerts-pricing-settings.service';
import { PlatformFeeSettingsService } from './platform-fee-settings.service';

@Module({
  controllers: [PlansController],
  providers: [
    BoostPricingSettingsService,
    SubscriptionPlanSettingsService,
    InstantAlertsPricingSettingsService,
    PlatformFeeSettingsService,
  ],
  exports: [
    BoostPricingSettingsService,
    SubscriptionPlanSettingsService,
    InstantAlertsPricingSettingsService,
    PlatformFeeSettingsService,
  ],
})
export class PlansModule {}
