import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Area as AreaDto, City as CityDto, ReverseGeocodeResultDto } from '@bhavano/types';
import { slugify } from '@bhavano/types/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { GeoIpService } from './geoip.service';
import type { Area, City } from '@prisma/client';

/** See `cityForIp` for why this is as loose as it is. */
const IP_CITY_MAX_KM = 150;

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
    private readonly geoIp: GeoIpService,
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

  /** Case-insensitive match on (name, state) first, so casing variants of an already-known city
   * don't create a duplicate — mirrors `ensureArea`'s semantics. Unlike `ensureArea`, City can
   * come back `null`: a same-slug collision with an existing city in a *different* state would be
   * permanently unreachable via `resolveCity` (apps/web/src/lib/browseRoute.ts matches purely on
   * slugify(name), no state disambiguation in the URL) — the caller treats `null` the same as an
   * unmatched location today, rather than creating an unroutable duplicate. Only called from
   * `reverseGeocodeGoogle` for now; City is otherwise still a curated/seed-only set. */
  async ensureCity(name: string, state: string, lat: number, lng: number): Promise<City | null> {
    const trimmedName = name.trim();
    const trimmedState = state.trim();

    const existing = await this.prisma.city.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' }, state: { equals: trimmedState, mode: 'insensitive' } },
    });
    if (existing) return existing;

    const allCities = await this.prisma.city.findMany();
    if (allCities.some((c) => slugify(c.name) === slugify(trimmedName))) return null;

    return this.prisma.city.create({
      data: { name: trimmedName, state: trimmedState, lat, lng, source: 'user-submitted' },
    });
  }

  /** Nearest-city lookup for "Auto-detect" — plain distance calc over all cities;
   * swap for a real PostGIS ST_Distance query once city count grows past a full scan.
   *
   * `maxKm` caps how far the answer may be. Unset for the auto-detect button, where the user
   * pressed it and any nearest city beats nothing. Set for the IP path, where nobody asked:
   * without a cap, a visitor in Singapore or behind an unmappable address is silently handed
   * whichever Indian city happens to be closest, presented as if it were theirs. */
  async reverseGeocode(lat: number, lng: number, maxKm?: number): Promise<CityDto | null> {
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
    if (maxKm !== undefined && nearestDist > maxKm) return null;
    return toDto(nearest);
  }

  /** The city an IP looks like it is in, or null if that cannot be answered confidently.
   *
   * 150km is deliberately generous. Indian mobile carriers route large regions through a handful
   * of peering cities, so a Coimbatore user on Jio can resolve to Chennai — wrong, but a better
   * default than Bengaluru and one click from corrected. A tighter cap would reject those and
   * gain little; a looser one starts labelling foreign traffic as Indian. */
  async cityForIp(ip: string): Promise<CityDto | null> {
    const point = this.geoIp.lookup(ip);
    if (!point) return null;
    return this.reverseGeocode(point.lat, point.lng, IP_CITY_MAX_KM);
  }

  /** Real Google-backed reverse geocoding for the map pin-picker (posting flow) — distinct from
   * `reverseGeocode` above, which stays a plain haversine nearest-city scan for the homepage's
   * unrelated "auto-detect my location" button. Uses a server-side, IP-restricted API key —
   * never call Google's Geocoding API directly from a browser/app with this key.
   *
   * City is matched against the existing table first, then auto-created via `ensureCity` (using
   * the dropped pin's own coordinates as the new city's lat/lng — the best approximation available
   * without a second API call) if Google resolved a locality+state that doesn't match one yet, the
   * same match-or-create semantics `ensureArea` already established for Area. `cityId` only stays
   * undefined for the residual cases `ensureCity` itself declines (no state component in Google's
   * response, or a same-slug collision with an existing city in another state) — the client treats
   * that the same as "couldn't confidently place this pin". See
   * docs/plans/support-uncovered-city-area-map-picker.md. */
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
    const state = result.address_components.find((c) => c.types.includes('administrative_area_level_1'));
    const resolvedLocality = sublocality?.long_name ?? locality?.long_name ?? '';

    let city = locality
      ? await this.prisma.city.findFirst({ where: { name: { equals: locality.long_name, mode: 'insensitive' } } })
      : null;
    let isNewCity = false;

    if (!city && locality && state) {
      city = await this.ensureCity(locality.long_name, state.long_name, lat, lng);
      isNewCity = city !== null;
    }

    const area = city && resolvedLocality ? await this.ensureArea(city.id, resolvedLocality) : null;

    return {
      cityId: city?.id,
      areaId: area?.id,
      formattedAddress: result.formatted_address,
      resolvedLocality,
      cityName: city?.name,
      isNewCity,
    };
  }
}
