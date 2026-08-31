import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
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

  /** Real Google-backed reverse geocoding — used by the posting flow's map pin-picker and by
   * "Auto-detect my current location" on the homepage/app. The only reverse-geocoding path left:
   * see docs/plans/remove-automatic-ip-city-detection.md for why the plain haversine
   * nearest-city version (`GET /reverse`) and the IP-based guess (`GET /by-ip`) were removed
   * rather than kept alongside this. */
  @Post('reverse-geocode')
  reverseGeocodeGoogle(@Body() dto: ReverseGeocodeDto): Promise<ReverseGeocodeResultDto> {
    return this.locationsService.reverseGeocodeGoogle(dto.lat, dto.lng);
  }
}
