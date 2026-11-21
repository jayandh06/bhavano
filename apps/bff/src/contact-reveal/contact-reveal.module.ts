import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module';
import { OwnerAlertsModule } from '../owner-alerts/owner-alerts.module';
import { ContactRevealService } from './contact-reveal.service';

@Module({
  imports: [OwnerAlertsModule, AdsModule],
  providers: [ContactRevealService],
  exports: [ContactRevealService],
})
export class ContactRevealModule {}
