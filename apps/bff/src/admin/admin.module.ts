import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ListingsModule } from '../listings/listings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { OutreachModule } from '../outreach/outreach.module';

@Module({
  imports: [ListingsModule, MessagingModule, NotificationsModule, RateLimitModule, OutreachModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
