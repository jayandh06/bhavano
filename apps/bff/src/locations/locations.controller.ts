import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { Area, City } from '@bhavano/types';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  searchCities(@Query('q') q?: string): Promise<City[]> {
    return this.locationsService.searchCities(q);
  }

  @Get('areas')
  searchAreas(@Query('cityId') cityId: string, @Query('q') q?: string): Promise<Area[]> {
    if (!cityId) throw new BadRequestException('cityId query param is required');
    return this.locationsService.searchAreas(cityId, q);
  }

  @Get('reverse')
  reverseGeocode(@Query('lat') latRaw: string, @Query('lng') lngRaw: string): Promise<City | null> {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException('lat and lng query params must be numbers');
    }
    return this.locationsService.reverseGeocode(lat, lng);
  }
}
