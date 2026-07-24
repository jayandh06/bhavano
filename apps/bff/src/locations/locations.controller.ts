import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Area, City, ReverseGeocodeResultDto } from '@bhavano/types';
import { LocationsService } from './locations.service';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  searchCities(@Query('q') q?: string, @Query('all') all?: string): Promise<City[]> {
    return this.locationsService.searchCities(q, all === 'true');
  }

  @Get('areas')
  searchAreas(
    @Query('cityId') cityId: string,
    @Query('q') q?: string,
    @Query('all') all?: string,
  ): Promise<Area[]> {
    if (!cityId) throw new BadRequestException('cityId query param is required');
    return this.locationsService.searchAreas(cityId, q, all === 'true');
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

  /** Real Google-backed reverse geocoding for the map pin-picker (posting flow) — distinct from
   * `GET /reverse` above, which stays the plain haversine nearest-city lookup for the homepage's
   * unrelated "auto-detect my location" button. */
  @Post('reverse-geocode')
  reverseGeocodeGoogle(@Body() dto: ReverseGeocodeDto): Promise<ReverseGeocodeResultDto> {
    return this.locationsService.reverseGeocodeGoogle(dto.lat, dto.lng);
  }
}
