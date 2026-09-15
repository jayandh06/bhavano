import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { BoostPricingSettingsService } from './boost-pricing-settings.service';
import { SubscriptionPlanSettingsService } from './subscription-plan-settings.service';
import { InstantAlertsPricingSettingsService } from './instant-alerts-pricing-settings.service';

@Module({
  controllers: [PlansController],
  providers: [BoostPricingSettingsService, SubscriptionPlanSettingsService, InstantAlertsPricingSettingsService],
  exports: [BoostPricingSettingsService, SubscriptionPlanSettingsService, InstantAlertsPricingSettingsService],
})
export class PlansModule {}
