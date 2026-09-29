import { Module } from '@nestjs/common';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { RequirementFeedController } from './requirement-feed.controller';
import { RequirementFeedService } from './requirement-feed.service';
import { RequirementDigestJob } from './requirement-digest.job';
import { RequirementMatchJob } from './requirement-match.job';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesModule } from '../saved-searches/saved-searches.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [NotificationsModule, SavedSearchesModule, AnalyticsModule],
  controllers: [RequirementsController, RequirementFeedController],
  providers: [RequirementsService, RequirementFeedService, RequirementDigestJob, RequirementMatchJob],
  exports: [RequirementsService],
})
export class RequirementsModule {}
