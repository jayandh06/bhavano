import { Module } from '@nestjs/common';
import { AreaOverviewsAdminController, AreaOverviewsPublicController } from './area-overviews.controller';
import { AreaOverviewsService } from './area-overviews.service';

@Module({
  controllers: [AreaOverviewsPublicController, AreaOverviewsAdminController],
  providers: [AreaOverviewsService],
})
export class AreaOverviewsModule {}
