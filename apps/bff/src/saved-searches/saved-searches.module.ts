import { Module } from '@nestjs/common';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [NotificationsModule, LocationsModule],
  controllers: [SavedSearchesController],
  providers: [SavedSearchesService],
  exports: [SavedSearchesService],
})
export class SavedSearchesModule {}
