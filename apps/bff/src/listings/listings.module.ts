import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingPhotosService } from './listing-photos.service';
import { ModerationModule } from '../moderation/moderation.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesModule } from '../saved-searches/saved-searches.module';
import { LocationsModule } from '../locations/locations.module';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';
import { StorageModule } from '../storage/storage.module';
import { AdsModule } from '../ads/ads.module';
import { ContactRevealModule } from '../contact-reveal/contact-reveal.module';

@Module({
  imports: [ModerationModule, RateLimitModule, NotificationsModule, SavedSearchesModule, LocationsModule, StorageModule, ListingSlotsModule, AdsModule, ContactRevealModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingPhotosService],
  exports: [ListingsService, ListingPhotosService],
})
export class ListingsModule {}
