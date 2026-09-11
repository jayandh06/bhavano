import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsModule } from '../listings/listings.module';
import { StorageModule } from '../storage/storage.module';
import { OutreachService } from './outreach.service';
import { OutreachSenderService } from './outreach-sender.service';
import { OutreachCampaignJob } from './outreach-campaign.job';

@Module({
  // NotificationsModule: for Msg91Provider — OutreachService.sendClaimVerification reuses its
  // proven WhatsApp-send shape rather than OutreachSenderService's own (unconfirmed, never
  // actually sent) one. ListingsModule/StorageModule: for createListingFromContact, which posts
  // a real Listing (via the unmodified ListingsService.create()) and uploads scraped photos to
  // R2 directly, the same two pieces UploadsController itself uses.
  imports: [NotificationsModule, ListingsModule, StorageModule],
  providers: [OutreachService, OutreachSenderService, OutreachCampaignJob],
  exports: [OutreachService, OutreachCampaignJob],
})
export class OutreachModule {}
