import { BadRequestException, Controller, Get, HttpCode, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Area, City } from '@bhavano/types';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  searchCities(@Query('q') q?: string, @Query('all') all?: string): Promise<City[]> {
    return this.locationsService.searchCities(q, all === 'true');
  }

  @Get('areas')
  searchAreas(@Query('cityId') cityId: string, @Query('q') q?: string): Promise<Area[]> {
    if (!cityId) throw new BadRequestException('cityId query param is required');
    return this.locationsService.searchAreas(cityId, q);
  }

  @Get('reverse')
  async reverseGeocode(
    @Query('lat') latRaw: string,
    @Query('lng') lngRaw: string,
    @Res() res: Response,
  ): Promise<void> {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException('lat and lng query params must be numbers');
    }
    const city = await this.locationsService.reverseGeocode(lat, lng);
    res.json(city);
  }
}
