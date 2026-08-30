import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailProvider } from './providers/email.provider';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

@Module({
  providers: [
    NotificationsService,
    EmailProvider,
    Msg91Provider,
    WhatsappProvider,
  ],
  exports: [
    NotificationsService,
    Msg91Provider,
    EmailProvider,
    WhatsappProvider,
  ],
})
export class NotificationsModule {}
