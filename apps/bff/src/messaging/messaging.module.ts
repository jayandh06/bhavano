import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagesController } from './messages.controller';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { PushModule } from '../push/push.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [PushModule, NotificationsModule, ListingsModule],
  controllers: [MessagingController, MessagesController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
