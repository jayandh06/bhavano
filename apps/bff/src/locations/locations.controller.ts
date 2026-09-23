import { BadRequestException, Body, Controller, Get, Post, Query, StreamableFile } from '@nestjs/common';
import type { Area, City, PlaceAutocompletePrediction, PlaceGeocodeResultDto, ReverseGeocodeResultDto } from '@bhavano/types';
import { LocationsService } from './locations.service';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { PlaceDetailsDto } from './dto/place-details.dto';

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

  /** Old city slug → the curated city its listings were moved onto. Null when the slug is live
   * or unknown. The web app 308s; this does not itself redirect. */
  @Get('slug-redirect')
  slugRedirect(@Query('slug') slug?: string): Promise<City | null> {
    if (!slug?.trim()) return Promise.resolve(null);
    return this.locationsService.resolveSlugRedirect(slug.trim());
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

  /** Backs the map picker's address search box — see LocationsService.placeAutocomplete's own
   * doc comment for why this proxies Google rather than the mobile app calling it directly. */
  @Get('place-autocomplete')
  placeAutocomplete(@Query('query') query?: string): Promise<PlaceAutocompletePrediction[]> {
    if (!query || query.trim().length < 2) return Promise.resolve([]);
    return this.locationsService.placeAutocomplete(query);
  }

  @Post('place-details')
  async placeDetails(@Body() dto: PlaceDetailsDto): Promise<PlaceGeocodeResultDto> {
    const result = await this.locationsService.resolvePlaceId(dto.placeId);
    if (!result) throw new BadRequestException("Couldn't resolve that place");
    return result;
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
