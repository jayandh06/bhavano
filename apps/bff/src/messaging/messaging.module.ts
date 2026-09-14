import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagesController } from './messages.controller';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [MessagingController, MessagesController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
