import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingExpiryReminderJob } from './listing-expiry-reminder.job';
import { ListingPostedReminderJob } from './listing-posted-reminder.job';

@Module({
  imports: [NotificationsModule],
  providers: [ListingExpiryReminderJob, ListingPostedReminderJob],
})
export class SellerJobsModule {}
