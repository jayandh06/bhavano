import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { logThirdPartyCall, maskUrlParam } from '../../logging/thirdPartyCallLogger';
import type { NearbyLandmarksProvider } from './nearby-landmarks.provider';

const SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const SEARCH_RADIUS_METERS = 1500;
const MAX_RESULTS = 6;

// Up to 50 allowed in one request — these cover what a buyer actually asks about ("is it near a
// school/market/station?"). One call, not one per type, is what keeps this to a single Places
// charge per generation. See docs/plans/ai-listing-copy-assist.md's cost breakdown.
const INCLUDED_TYPES = [
  'bus_station',
  'train_station',
  'subway_station',
  'shopping_mall',
  'supermarket',
  'school',
  'hospital',
  'pharmacy',
  'restaurant',
  'park',
];

interface SearchNearbyResponse {
  places?: { displayName?: { text?: string } }[];
}

/** Real nearby place names from Google's Places API (New) — reuses the existing
 * GOOGLE_MAPS_SERVER_KEY already used for Geocoding/Autocomplete/Details/Static Maps in
 * LocationsService (the new Places API needs enabling on the same GCP project as a one-time ops
 * step, not a new credential). This is Featured-tier only — by far the most expensive single
 * call in the pipeline, see AiService. */
@Injectable()
export class GooglePlacesNearbyLandmarksProvider implements NearbyLandmarksProvider {
  private readonly logger = new Logger(GooglePlacesNearbyLandmarksProvider.name);

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(GooglePlacesNearbyLandmarksProvider.name) private readonly callLogger: PinoLogger,
  ) {}

  async findNearby(lat: number, lng: number): Promise<string[]> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_SERVER_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Nearby-landmarks lookup is not configured on this server yet');
    }

    const body = {
      includedTypes: INCLUDED_TYPES,
      maxResultCount: MAX_RESULTS,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: SEARCH_RADIUS_METERS },
      },
    };
    const maskedUrl = maskUrlParam(SEARCH_NEARBY_URL, 'key');
    const res = await fetch(SEARCH_NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName',
      },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
      this.logger.warn(`Google Places searchNearby request failed: ${res.status}`);
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'google-places',
        method: 'searchNearby',
        url: maskedUrl,
        request: { lat, lng, radius: SEARCH_RADIUS_METERS },
        status: res.status,
        responseText,
        ok: false,
      });
      throw new ServiceUnavailableException('Nearby-landmarks lookup failed');
    }

    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'google-places',
      method: 'searchNearby',
      url: maskedUrl,
      request: { lat, lng, radius: SEARCH_RADIUS_METERS },
      status: res.status,
      ok: true,
    });

    const data = JSON.parse(responseText) as SearchNearbyResponse;
    const names = (data.places ?? [])
      .map((p) => p.displayName?.text)
      .filter((name): name is string => Boolean(name));
    return [...new Set(names)];
  }
}
