import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { BoostPricingSettingsService } from './boost-pricing-settings.service';
import { SubscriptionPlanSettingsService } from './subscription-plan-settings.service';

@Module({
  controllers: [PlansController],
  providers: [BoostPricingSettingsService, SubscriptionPlanSettingsService],
  exports: [BoostPricingSettingsService, SubscriptionPlanSettingsService],
})
export class PlansModule {}
