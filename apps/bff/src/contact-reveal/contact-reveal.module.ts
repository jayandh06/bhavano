import { Module } from '@nestjs/common';
import { OwnerAlertsModule } from '../owner-alerts/owner-alerts.module';
import { ContactRevealService } from './contact-reveal.service';

@Module({
  imports: [OwnerAlertsModule],
  providers: [ContactRevealService],
  exports: [ContactRevealService],
})
export class ContactRevealModule {}
