import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Area, City, ReverseGeocodeResultDto } from '@bhavano/types';
import { LocationsService } from './locations.service';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';

/** The address Caddy actually saw, not the one the client claimed.
 *
 * The LAST X-Forwarded-For entry, matching web's middleware: Caddy appends the connecting peer to
 * whatever header arrived, so a client sending its own produces "spoofed, real" — the leftmost
 * value is attacker-controlled and the rightmost is what Caddy observed. Only reached for callers
 * that pass no explicit ip, so a wrong answer costs a fallback to "no city", never a wrong page.
 */
function clientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  const header = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  const hops = (header ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return hops[hops.length - 1] ?? request.socket?.remoteAddress ?? undefined;
}

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
   * The address is a query param for web and omitted by the app, because who the visitor is
   * differs by caller. Web asks during a server-side render, so the socket here belongs to the
   * web container and only the param identifies the actual visitor. The app calls from the
   * device, so its own connection *is* the visitor and there is nothing for it to pass — it has
   * no way to learn its public address anyway. */
  @Get('by-ip')
  cityForIp(
    @Req() request: Request,
    @Query('ip') ip?: string,
  ): Promise<City | null> {
    const address = ip ?? clientIp(request);
    // Null, not a 400: "I could not tell where you are" is the same answer the service gives for
    // an unmappable address, and every caller already falls back to its own default.
    if (!address) return Promise.resolve(null);
    return this.locationsService.cityForIp(address);
  }

  /** Real Google-backed reverse geocoding for the map pin-picker (posting flow) — distinct from
   * `GET /reverse` above, which stays the plain haversine nearest-city lookup for the homepage's
   * unrelated "auto-detect my location" button. */
  @Post('reverse-geocode')
  reverseGeocodeGoogle(@Body() dto: ReverseGeocodeDto): Promise<ReverseGeocodeResultDto> {
    return this.locationsService.reverseGeocodeGoogle(dto.lat, dto.lng);
  }
}
