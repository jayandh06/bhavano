import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailProvider } from './providers/email.provider';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { FacebookProvider } from './providers/facebook.provider';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

@Module({
  controllers: [WhatsappWebhookController],
  providers: [
    NotificationsService,
    EmailProvider,
    Msg91Provider,
    WhatsappProvider,
    FacebookProvider,
  ],
  exports: [
    NotificationsService,
    Msg91Provider,
    EmailProvider,
    WhatsappProvider,
    FacebookProvider,
  ],
})
export class NotificationsModule {}
