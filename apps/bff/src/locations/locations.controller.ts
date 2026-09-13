import { BadRequestException, Body, Controller, Get, Post, Query, StreamableFile } from '@nestjs/common';
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

  /** Proxies the Google Static Maps API — see LocationsService.getStaticMapImage's own doc
   * comment for why the mobile app can't just call Google directly with its own key the way the
   * website's map preview does. */
  @Get('static-map')
  async staticMap(@Query('lat') lat: string, @Query('lng') lng: string): Promise<StreamableFile> {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      throw new BadRequestException('lat and lng query params are required');
    }
    const { buffer, contentType } = await this.locationsService.getStaticMapImage(latNum, lngNum);
    return new StreamableFile(buffer, { type: contentType });
  }
}
