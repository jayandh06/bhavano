import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingExpiryReminderJob } from './listing-expiry-reminder.job';
import { ListingPostedReminderJob } from './listing-posted-reminder.job';
import { DailyActivityDigestJob } from './daily-activity-digest.job';

@Module({
  imports: [NotificationsModule],
  providers: [
    ListingExpiryReminderJob,
    ListingPostedReminderJob,
    DailyActivityDigestJob,
  ],
})
export class SellerJobsModule {}
