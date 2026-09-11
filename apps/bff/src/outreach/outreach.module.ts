import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutreachService } from './outreach.service';
import { OutreachSenderService } from './outreach-sender.service';
import { OutreachCampaignJob } from './outreach-campaign.job';

@Module({
  // For Msg91Provider — OutreachService.sendClaimVerification reuses its proven WhatsApp-send
  // shape rather than OutreachSenderService's own (unconfirmed, never actually sent) one.
  imports: [NotificationsModule],
  providers: [OutreachService, OutreachSenderService, OutreachCampaignJob],
  exports: [OutreachService, OutreachCampaignJob],
})
export class OutreachModule {}
