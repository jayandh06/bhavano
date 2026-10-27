import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { OwnerAlertsService } from './owner-alerts.service';

@Module({
  imports: [NotificationsModule, PushModule],
  providers: [OwnerAlertsService],
  exports: [OwnerAlertsService],
})
export class OwnerAlertsModule {}
