import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Area as AreaDto, City as CityDto, ReverseGeocodeResultDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { Area, City } from '@prisma/client';

interface GoogleGeocodeAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  formatted_address: string;
  address_components: GoogleGeocodeAddressComponent[];
}

interface GoogleGeocodeResponse {
  status: string;
  results: GoogleGeocodeResult[];
  error_message?: string;
}

function toDto(city: City): CityDto {
  return {
    id: city.id,
    name: city.name,
    state: city.state,
    lat: city.lat,
    lng: city.lng,
    isPopular: city.isPopular,
  };
}

function toAreaDto(area: Area): AreaDto {
  return { id: area.id, name: area.name, cityId: area.cityId, lat: area.lat, lng: area.lng };
}

/** Great-circle distance in km — good enough for nearest-city lookup at city granularity. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async searchCities(q?: string, all?: boolean): Promise<CityDto[]> {
    if (!q && all) {
      const cities = await this.prisma.city.findMany({
        orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
      });
      return cities.map(toDto);
    }

    if (!q) {
      const popular = await this.prisma.city.findMany({
        where: { isPopular: true },
        orderBy: { name: 'asc' },
      });
      return popular.map(toDto);
    }

    const matches = await this.prisma.city.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 10,
    });
    return matches.map(toDto);
  }

  async searchAreas(cityId: string, q?: string, all?: boolean): Promise<AreaDto[]> {
    const matches = await this.prisma.area.findMany({
      where: { cityId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { name: 'asc' },
      // `all=true` (the multi-select area filter, which needs every area in the city) drops the
      // cap the location-picker's autocomplete-style search otherwise wants.
      ...(all ? {} : { take: 15 }),
    });
    return matches.map(toAreaDto);
  }

  /** Case-insensitive match against existing areas in the city first, so casing/whitespace
   * variants of an already-known area ("koramangala" vs "Koramangala") don't create a duplicate.
   * Shared by ListingsService (posting a new ad) and SavedSearchesService (saving a search with
   * an area not yet in the curated list). */
  async ensureArea(cityId: string, name?: string): Promise<Area> {
    if (!name?.trim()) throw new BadRequestException('Either areaId or areaName is required');
    const trimmed = name.trim();

    const existing = await this.prisma.area.findFirst({
      where: { cityId, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) return existing;

    return this.prisma.area.create({ data: { name: trimmed, cityId, source: 'user-submitted' } });
  }

  /** Nearest-city lookup for "Auto-detect" — plain distance calc over all cities;
   * swap for a real PostGIS ST_Distance query once city count grows past a full scan. */
  async reverseGeocode(lat: number, lng: number): Promise<CityDto | null> {
    const cities = await this.prisma.city.findMany();
    if (cities.length === 0) return null;

    let nearest = cities[0];
    let nearestDist = haversineKm({ lat, lng }, nearest);
    for (const city of cities.slice(1)) {
      const dist = haversineKm({ lat, lng }, city);
      if (dist < nearestDist) {
        nearest = city;
        nearestDist = dist;
      }
    }
    return toDto(nearest);
  }

  /** Real Google-backed reverse geocoding for the map pin-picker (posting flow) — distinct from
   * `reverseGeocode` above, which stays a plain haversine nearest-city scan for the homepage's
   * unrelated "auto-detect my location" button. Uses a server-side, IP-restricted API key —
   * never call Google's Geocoding API directly from a browser/app with this key.
   *
   * City is matched against the existing curated table only, never auto-created (City is
   * load-bearing for SEO URL structure and routing, and is deliberately kept small) — if Google's
   * resolved locality doesn't match an existing City, `cityId` comes back undefined and the
   * client should tell the user Bhavano isn't live there yet. Area, once a City match is found,
   * reuses `ensureArea` directly — the same match-or-create semantics already shared with
   * ListingsService and SavedSearchesService. See docs/plans/google-maps-location-picker.md. */
  async reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResultDto> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_SERVER_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Location lookup is not configured on this server yet');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.warn(`Google Geocoding API request failed: ${res.status}`);
      throw new ServiceUnavailableException('Failed to look up that location');
    }

    const data = (await res.json()) as GoogleGeocodeResponse;
    const result = data.results[0];
    if (data.status !== 'OK' || !result) {
      this.logger.warn(
        `Google Geocoding API returned ${data.status} for ${lat},${lng}${data.error_message ? `: ${data.error_message}` : ''}`,
      );
      return { formattedAddress: '', resolvedLocality: '' };
    }

    const locality = result.address_components.find((c) => c.types.includes('locality'));
    const sublocality = result.address_components.find(
      (c) => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'),
    );
    const resolvedLocality = sublocality?.long_name ?? locality?.long_name ?? '';

    const city = locality
      ? await this.prisma.city.findFirst({ where: { name: { equals: locality.long_name, mode: 'insensitive' } } })
      : null;

    const area = city && resolvedLocality ? await this.ensureArea(city.id, resolvedLocality) : null;

    return {
      cityId: city?.id,
      areaId: area?.id,
      formattedAddress: result.formatted_address,
      resolvedLocality,
    };
  }
}
