import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GeoIpService } from './geoip.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, GeoIpService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
