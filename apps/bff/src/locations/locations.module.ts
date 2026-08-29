import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { GeoIpService } from './geoip.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, GeoIpService],
  exports: [LocationsService],
})
export class LocationsModule {}
