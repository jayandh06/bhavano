import { Module } from '@nestjs/common';
import { OutreachService } from './outreach.service';
import { OutreachSenderService } from './outreach-sender.service';
import { OutreachCampaignJob } from './outreach-campaign.job';

@Module({
  providers: [OutreachService, OutreachSenderService, OutreachCampaignJob],
  exports: [OutreachService, OutreachCampaignJob],
})
export class OutreachModule {}
