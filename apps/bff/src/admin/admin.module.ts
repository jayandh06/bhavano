import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ListingsModule } from '../listings/listings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { OutreachModule } from '../outreach/outreach.module';
import { ContactRevealModule } from '../contact-reveal/contact-reveal.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ListingsModule,
    MessagingModule,
    NotificationsModule,
    RateLimitModule,
    OutreachModule,
    ContactRevealModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
