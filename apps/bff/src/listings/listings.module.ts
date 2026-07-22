import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ModerationModule } from '../moderation/moderation.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesModule } from '../saved-searches/saved-searches.module';

@Module({
  imports: [ModerationModule, RateLimitModule, NotificationsModule, SavedSearchesModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
