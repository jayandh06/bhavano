import { Module } from '@nestjs/common';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { RequirementDigestJob } from './requirement-digest.job';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesModule } from '../saved-searches/saved-searches.module';

@Module({
  imports: [NotificationsModule, SavedSearchesModule],
  controllers: [RequirementsController],
  providers: [RequirementsService, RequirementDigestJob],
  exports: [RequirementsService],
})
export class RequirementsModule {}
