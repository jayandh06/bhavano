import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralsAdminService } from './referrals-admin.service';
import { ReferralNotificationsService } from './referral-notifications.service';
import { ReferralCreditExpiryReminderJob } from './referral-credit-expiry-reminder.job';

@Module({
  imports: [NotificationsModule, PushModule],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralsAdminService, ReferralNotificationsService, ReferralCreditExpiryReminderJob],
  exports: [ReferralsService, ReferralsAdminService],
})
export class ReferralsModule {}
