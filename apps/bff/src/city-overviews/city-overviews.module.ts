import { Module } from '@nestjs/common';
import { CityOverviewsAdminController, CityOverviewsPublicController } from './city-overviews.controller';
import { CityOverviewsService } from './city-overviews.service';

@Module({
  controllers: [CityOverviewsPublicController, CityOverviewsAdminController],
  providers: [CityOverviewsService],
})
export class CityOverviewsModule {}
