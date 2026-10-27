import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingPhotosService } from './listing-photos.service';
import { AssistedListingExpiryJob } from './assisted-listing-expiry.job';
import { LoginNudgeService } from './login-nudge.service';
import { ModerationModule } from '../moderation/moderation.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesModule } from '../saved-searches/saved-searches.module';
import { LocationsModule } from '../locations/locations.module';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';
import { StorageModule } from '../storage/storage.module';
import { AdsModule } from '../ads/ads.module';
import { ContactRevealModule } from '../contact-reveal/contact-reveal.module';
import { PlansModule } from '../plans/plans.module';
import { PushModule } from '../push/push.module';
import { OwnerAlertsModule } from '../owner-alerts/owner-alerts.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReferralsModule } from '../referrals/referrals.module';

import { QuickResponderService } from './quick-responder.service';
import { PostedConfirmationService } from './posted-confirmation.service';
import { PostedConfirmationJob } from './posted-confirmation.job';
import { ScheduledPublishJob } from './scheduled-publish.job';
import { PostedConfirmationController } from './posted-confirmation.controller';

@Module({
  imports: [ModerationModule, RateLimitModule, NotificationsModule, SavedSearchesModule, LocationsModule, StorageModule, ListingSlotsModule, AdsModule, ContactRevealModule, PlansModule, PushModule, AnalyticsModule, ReferralsModule, OwnerAlertsModule],
  controllers: [ListingsController, PostedConfirmationController],
  providers: [ListingsService, ListingPhotosService, AssistedListingExpiryJob, LoginNudgeService, QuickResponderService, PostedConfirmationService, PostedConfirmationJob, ScheduledPublishJob],
  exports: [ListingsService, ListingPhotosService, LoginNudgeService],
})
export class ListingsModule {}
