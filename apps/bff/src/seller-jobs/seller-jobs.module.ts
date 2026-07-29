import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingExpiryReminderJob } from './listing-expiry-reminder.job';

@Module({
  imports: [NotificationsModule],
  providers: [ListingExpiryReminderJob],
})
export class SellerJobsModule {}
