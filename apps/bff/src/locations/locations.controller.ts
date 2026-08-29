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

  /** Coarse IP → city, for choosing which city to open on for a visitor who has never picked
   * one. Returns null rather than erroring whenever the answer is not confident — no GeoLite2
   * database configured, a private or malformed address, or the nearest city being implausibly
   * far away — and the caller falls back to its own default. See
   * docs/plans/visitor-location-default-city.md.
   *
   * Takes the address as a query param rather than reading it off this request: the caller is
   * web's server-side render, so the socket here belongs to the web container, not the visitor. */
  @Get('by-ip')
  cityForIp(@Query('ip') ip?: string): Promise<City | null> {
    if (!ip) throw new BadRequestException('ip query param is required');
    return this.locationsService.cityForIp(ip);
  }

  /** Real Google-backed reverse geocoding for the map pin-picker (posting flow) — distinct from
   * `GET /reverse` above, which stays the plain haversine nearest-city lookup for the homepage's
   * unrelated "auto-detect my location" button. */
  @Post('reverse-geocode')
  reverseGeocodeGoogle(@Body() dto: ReverseGeocodeDto): Promise<ReverseGeocodeResultDto> {
    return this.locationsService.reverseGeocodeGoogle(dto.lat, dto.lng);
  }
}
