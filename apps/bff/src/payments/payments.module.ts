import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BoostRotationService } from './boost-rotation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdsModule } from '../ads/ads.module';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [NotificationsModule, AdsModule, ListingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, BoostRotationService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
