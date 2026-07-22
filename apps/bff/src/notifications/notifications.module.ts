import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailProvider } from './providers/email.provider';
import { Msg91Provider } from './providers/msg91.provider';

@Module({
  providers: [NotificationsService, EmailProvider, Msg91Provider],
  exports: [NotificationsService, Msg91Provider],
})
export class NotificationsModule {}
