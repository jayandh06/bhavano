import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { BoostPricingSettingsService } from './boost-pricing-settings.service';
import { SubscriptionPlanSettingsService } from './subscription-plan-settings.service';
import { InstantAlertsPricingSettingsService } from './instant-alerts-pricing-settings.service';
import { PlatformFeeSettingsService } from './platform-fee-settings.service';
import { BoostEffectivenessStatService } from './boost-effectiveness.service';
import { BoostEffectivenessJob } from './boost-effectiveness.job';

@Module({
  controllers: [PlansController],
  providers: [
    BoostPricingSettingsService,
    SubscriptionPlanSettingsService,
    InstantAlertsPricingSettingsService,
    PlatformFeeSettingsService,
    BoostEffectivenessStatService,
    BoostEffectivenessJob,
  ],
  exports: [
    BoostPricingSettingsService,
    SubscriptionPlanSettingsService,
    InstantAlertsPricingSettingsService,
    PlatformFeeSettingsService,
    BoostEffectivenessStatService,
  ],
})
export class PlansModule {}
