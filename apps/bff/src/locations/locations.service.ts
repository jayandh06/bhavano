import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Area as AreaDto,
  City as CityDto,
  PlaceAutocompletePrediction,
  PlaceGeocodeResultDto,
  ReverseGeocodeResultDto,
} from '@bhavano/types';
import { slugify } from '@bhavano/types/slugify';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { logThirdPartyCall, maskUrlParam } from '../logging/thirdPartyCallLogger';
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

/** True for an undefined/empty name, or one containing only ASCII — the range every English
 * place name Google returns actually falls in, punctuation and digits included. Deliberately not
 * a narrower "letters only" check: legitimate names contain "-", "'", "." (Rajaji Nagar,
 * D'Souza Circle, St. Marks Road), and this only needs to catch a name in a different script,
 * not validate its shape. See reverseGeocodeGoogle's own comment for the incident this closes. */
function isLatinText(name: string | undefined): name is string {
  return !!name && /^[\x00-\x7F]*$/.test(name);
}

/** Google's `formatted_address` is one pre-composed, comma-delimited string, so unlike the
 * address_components above there's no separate translated alternative to fall back to — the
 * fields feeding it just get built from the individual segments untranslated when Google has
 * never registered an English name for that specific feature. Confirmed live: `language=en`
 * still returned "...off ಬನ್ನೇರುಘಟ್ಟ ಮುಖ್ಯ ರಸ್ತೆ..." — a road name — inside an otherwise-English
 * address for a Bengaluru pin. Dropping the offending segment (rather than the whole address)
 * keeps the building/landmark/locality/city/state/country segments that did translate correctly,
 * which is everything a seller's address actually needs. Falls back to the untouched original if
 * every segment were non-Latin, so a real but fully-local-script result never renders as "". */
function stripNonLatinSegments(formattedAddress: string): string {
  const kept = formattedAddress.split(', ').filter(isLatinText);
  return kept.length > 0 ? kept.join(', ') : formattedAddress;
}

/** Google components that can name the market city. Sublocality is the area, not a candidate. */
const CITY_COMPONENT_TYPES = ['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_3'];

const ADMIN_NAME_SUFFIX = /\s+(Urban|Rural|District|Taluk|Tehsil|Tahsil|North|South|East|West|Central)$/i;

/** "Coimbatore North" → "Coimbatore", "Bengaluru Urban" → "Bengaluru". Trailing qualifiers only,
 * applied until none remain. Does not turn "South Delhi" into "Delhi" (the qualifier is leading)
 * and does not fuzzy-match "Delhi" to "Delhi NCR". */
function normalizeAdminName(name: string): string {
  let current = name.trim();
  let next = current.replace(ADMIN_NAME_SUFFIX, '').trim();
  while (next.length > 0 && next !== current) {
    current = next;
    next = current.replace(ADMIN_NAME_SUFFIX, '').trim();
  }
  return current;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** A known area's own coordinates count as that area only this close to the pin. */
const AREA_PIN_MATCH_KM = 5;

function uniqueNames(names: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

interface GooglePlacesAutocompleteResponse {
  status: string;
  predictions: { place_id: string; description: string }[];
  error_message?: string;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: { geometry?: { location?: { lat: number; lng: number } } };
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

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectPinoLogger(LocationsService.name) private readonly callLogger: PinoLogger,
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

  /** Former city slug left behind when a user-submitted city was merged onto a curated one.
   * The web catch-all 308s `/{slug}/...` to this city. */
  async resolveSlugRedirect(slug: string): Promise<CityDto | null> {
    const redirect = await this.prisma.citySlugRedirect.findUnique({
      where: { slug },
      include: { city: true },
    });
    return redirect ? toDto(redirect.city) : null;
  }

  /** Case-insensitive match against existing areas in the city first, so casing/whitespace
   * variants of an already-known area ("koramangala" vs "Koramangala") don't create a duplicate.
   * Shared by ListingsService (posting a new ad) and SavedSearchesService (saving a search with
   * an area not yet in the curated list). */
  async ensureArea(cityId: string, name?: string): Promise<Area> {
    if (!name?.trim()) throw new BadRequestException('Either areaId or areaName is required');
    const trimmed = name.trim();
    // slugify() strips anything outside [a-z0-9] — a name entirely in a non-Latin script (or
    // entirely punctuation/emoji) collapses to "", which can never be resolved back from a URL
    // (see resolveArea in apps/web/src/lib/browseRoute.ts, an exact slugify(name) match). Refuse
    // it here rather than silently creating an area no listing under it could ever be reached
    // through — see ensureCity's own guard below for the real incident this was found from.
    if (!slugify(trimmed)) {
      throw new BadRequestException('That location name needs at least one letter or number to build a URL from');
    }

    const existing = await this.prisma.area.findFirst({
      where: { cityId, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) return existing;

    return this.prisma.area.create({ data: { name: trimmed, cityId, source: 'user-submitted' } });
  }

  /** Curated city whose catchment contains this pin, choosing the nearest centroid when more than
   * one circle overlaps. Null when the pin is outside every curated city. User-submitted cities
   * are never candidates — a ward that was previously auto-created as its own city must not win
   * the next pin dropped near it. See docs/plans/canonical-city-catchment.md. */
  private cityWithinCatchment(curated: City[], lat: number, lng: number): City | null {
    let best: { city: City; distance: number } | null = null;
    for (const candidate of curated) {
      const distance = distanceKm(lat, lng, candidate.lat, candidate.lng);
      const radius = candidate.catchmentKm > 0 ? candidate.catchmentKm : 25;
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { city: candidate, distance };
      }
    }
    return best?.city ?? null;
  }

  /** When several curated areas share a name, prefer the one whose own pin is within
   * AREA_PIN_MATCH_KM, else the single candidate whose city catchment contains the pin. */
  private cityFromKnownAreas(
    areas: (Area & { city: City })[],
    lat: number,
    lng: number,
  ): City | null {
    if (areas.length === 0) return null;
    const nearPin = areas.filter(
      (area) =>
        area.lat != null && area.lng != null && distanceKm(lat, lng, area.lat, area.lng) <= AREA_PIN_MATCH_KM,
    );
    if (nearPin.length === 1) return nearPin[0].city;
    if (nearPin.length > 1) {
      return nearPin.reduce((nearest, area) =>
        distanceKm(lat, lng, area.lat!, area.lng!) < distanceKm(lat, lng, nearest.lat!, nearest.lng!) ? area : nearest,
      ).city;
    }
    const inCatchment = areas.filter(
      (area) => distanceKm(lat, lng, area.city.lat, area.city.lng) <= (area.city.catchmentKm > 0 ? area.city.catchmentKm : 25),
    );
    if (inCatchment.length === 1) return inCatchment[0].city;
    return null;
  }

  /** Case-insensitive match on (name, state) first, so casing variants of an already-known city
   * don't create a duplicate — mirrors `ensureArea`'s semantics. Unlike `ensureArea`, City can
   * come back `null`: a same-slug collision with an existing city in a *different* state would be
   * permanently unreachable via `resolveCity` (apps/web/src/lib/browseRoute.ts matches purely on
   * slugify(name), no state disambiguation in the URL) — the caller treats `null` the same as an
   * unmatched location today, rather than creating an unroutable duplicate. No longer called from
   * `reverseGeocodeGoogle` — a pin never mints a city. See docs/plans/canonical-city-catchment.md. */
  async ensureCity(name: string, state: string, lat: number, lng: number): Promise<City | null> {
    const trimmedName = name.trim();
    const trimmedState = state.trim();

    const existing = await this.prisma.city.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' }, state: { equals: trimmedState, mode: 'insensitive' } },
    });
    if (existing) return existing;

    // Real incident this guards against: Google's Geocoding API returned "मुंबई"/"महाराष्ट्र"
    // (Devanagari) for a dropped pin instead of "Mumbai"/"Maharashtra" — reverseGeocodeGoogle's
    // request didn't pin a response language, so Google fell back to the locality's local script.
    // slugify() strips anything outside [a-z0-9], so a non-Latin name collapses to "" — the
    // listing that got created under that city was permanently unreachable (every one of its
    // URLs, e.g. buildListingPath's `/${citySlug}/...`, had an empty first segment, which a
    // browser or <Link> then resolves as protocol-relative to a bogus host instead of a same-site
    // path). Treated the same as the existing same-slug-collision case below: decline rather than
    // create a city no listing under it could ever be reached through.
    const newSlug = slugify(trimmedName);
    const allCities = await this.prisma.city.findMany();
    if (!newSlug || allCities.some((c) => slugify(c.name) === newSlug)) return null;

    return this.prisma.city.create({
      data: { name: trimmedName, state: trimmedState, lat, lng, source: 'user-submitted' },
    });
  }

  /** Real Google-backed reverse geocoding — used by the posting flow's map pin-picker and by
   * "Auto-detect my current location". This is the only reverse-geocoding path in the app; the
   * plain haversine nearest-city scan that used to live here, and the IP-based city guess built
   * on top of it, were removed — see docs/plans/remove-automatic-ip-city-detection.md. Uses a
   * server-side, IP-restricted API key — never call Google's Geocoding API directly from a
   * browser/app with this key.
   *
   * City is a curated market, never a Google locality string. Resolution order (first hit wins):
   * a LocalityAlias, a curated city name read from every geocode result (after stripping a
   * trailing district/taluk/direction qualifier), an existing Area's parent city, then the
   * nearest curated city whose catchmentKm contains the pin. Outside every catchment, `cityId`
   * stays unset and nothing is created — the seller picks a city, and the local place is saved
   * as an area under it. See docs/plans/canonical-city-catchment.md. */
  async reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResultDto> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_SERVER_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Location lookup is not configured on this server yet');
    }

    // `language=en`: without it, Google answers in the locality's local script when it has one
    // (confirmed live — a Kharghar/Navi Mumbai pin came back with locality "मुंबई" and
    // administrative_area_level_1 "महाराष्ट्र", not "Mumbai"/"Maharashtra"). Every city/area name
    // in this app is otherwise Latin-script, and slugify() can't build a URL segment from
    // anything else — see ensureCity/ensureArea's own guards against that, added after this was
    // exactly what let one such city through.
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`;
    const maskedUrl = maskUrlParam(url, 'key');
    const res = await fetch(url);
    const responseText = await res.text();
    if (!res.ok) {
      this.logger.warn(`Google Geocoding API request failed: ${res.status}`);
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'google-maps',
        method: 'reverseGeocode',
        url: maskedUrl,
        request: { lat, lng },
        status: res.status,
        responseText,
        ok: false,
      });
      throw new ServiceUnavailableException('Failed to look up that location');
    }

    const data = JSON.parse(responseText) as GoogleGeocodeResponse;
    const result = data.results[0];
    if (data.status !== 'OK' || !result) {
      this.logger.warn(
        `Google Geocoding API returned ${data.status} for ${lat},${lng}${data.error_message ? `: ${data.error_message}` : ''}`,
      );
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'google-maps',
        method: 'reverseGeocode',
        url: maskedUrl,
        request: { lat, lng },
        status: res.status,
        responseText,
        ok: false,
      });
      return { formattedAddress: '', resolvedLocality: '' };
    }

    const locality = result.address_components.find((c) => c.types.includes('locality'));
    const sublocality = result.address_components.find(
      (c) => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'),
    );
    // `language=en` on the request (above) isn't a hard guarantee — Google still answers a
    // hyperlocal component (a hamlet/neighborhood name) in its local script when it has never
    // registered an English name for that specific place, even though the same response's
    // locality/state fields come back correctly translated. ensureArea's slugify() guard below
    // only catches a name that's *entirely* non-Latin (collapses to ""); it does nothing for one
    // that's non-Latin mixed with otherwise-English text, which is what actually reached the
    // screen as visible Kannada. Coarsen to the next reliable option instead of surfacing it.
    const resolvedLocality = isLatinText(sublocality?.long_name)
      ? sublocality!.long_name
      : isLatinText(locality?.long_name)
        ? locality!.long_name
        : '';

    const componentNames = data.results.flatMap((geocodeResult) =>
      geocodeResult.address_components
        .filter((component) => CITY_COMPONENT_TYPES.some((type) => component.types.includes(type)))
        .map((component) => component.long_name),
    );
    const aliasNames = uniqueNames([resolvedLocality, locality?.long_name, ...componentNames]);

    // 1. Admin-patched alias, including spelling pairs and Delhi NCR child names.
    const alias =
      aliasNames.length > 0
        ? await this.prisma.localityAlias.findFirst({
            where: { OR: aliasNames.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })) },
            include: { city: true },
          })
        : null;
    let city: City | null = alias?.city ?? null;

    const curated = city ? [] : await this.prisma.city.findMany({ where: { source: 'curated' } });

    // 2. Curated city name, from every result — "Coimbatore North" matches Coimbatore. A
    // user-submitted city with the ward's name is not in this list, so it cannot keep the pin.
    if (!city) {
      for (const raw of componentNames) {
        const normalized = normalizeAdminName(raw);
        city =
          curated.find((candidate) => candidate.name.toLowerCase() === raw.trim().toLowerCase()) ??
          curated.find((candidate) => candidate.name.toLowerCase() === normalized.toLowerCase()) ??
          null;
        if (city) break;
      }
    }

    // 3. A place name that is already an Area under a curated city inherits that city.
    if (!city && resolvedLocality) {
      const knownAreas = await this.prisma.area.findMany({
        where: { name: { equals: resolvedLocality, mode: 'insensitive' }, city: { source: 'curated' } },
        include: { city: true },
      });
      city = this.cityFromKnownAreas(knownAreas, lat, lng);
    }

    // 4. Pin inside a curated city's catchment. The local place stays the area.
    if (!city) city = this.cityWithinCatchment(curated, lat, lng);

    const areaName =
      city && resolvedLocality && resolvedLocality.trim().toLowerCase() !== city.name.trim().toLowerCase()
        ? resolvedLocality
        : '';
    const area = areaName && city ? await this.ensureArea(city.id, areaName) : null;

    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'google-maps',
      method: 'reverseGeocode',
      url: maskedUrl,
      request: { lat, lng },
      status: res.status,
      responseText,
      ok: true,
    });

    return {
      cityId: city?.id,
      areaId: area?.id,
      formattedAddress: stripNonLatinSegments(result.formatted_address),
      resolvedLocality,
      cityName: city?.name,
      isNewCity: false,
    };
  }

  /** Backs the map picker's address search box (native's own — web loads the Places JS SDK
   * client-side with a referrer-restricted key, which a distributed app binary can't do, same
   * reasoning as `getStaticMapImage`). `components=country:in`: Bhavano is India-only, and
   * without it a search for a common street name returns predictions from anywhere in the world
   * before the relevant Indian one. */
  async placeAutocomplete(query: string): Promise<PlaceAutocompletePrediction[]> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_SERVER_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Location lookup is not configured on this server yet');
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:in&language=en&key=${apiKey}`;
    const maskedUrl = maskUrlParam(url, 'key');
    const res = await fetch(url);
    const responseText = await res.text();
    if (!res.ok) {
      this.logger.warn(`Google Places Autocomplete API request failed: ${res.status}`);
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'google-maps',
        method: 'placeAutocomplete',
        url: maskedUrl,
        request: { query },
        status: res.status,
        responseText,
        ok: false,
      });
      throw new ServiceUnavailableException('Failed to search for that location');
    }

    const data = JSON.parse(responseText) as GooglePlacesAutocompleteResponse;
    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'google-maps',
      method: 'placeAutocomplete',
      url: maskedUrl,
      request: { query },
      status: res.status,
      responseText,
      ok: data.status === 'OK' || data.status === 'ZERO_RESULTS',
    });
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(
        `Google Places Autocomplete API returned ${data.status} for "${query}"${data.error_message ? `: ${data.error_message}` : ''}`,
      );
      return [];
    }

    // Same untranslated-segment issue as reverseGeocodeGoogle's formatted_address — Autocomplete's
    // `description` is Google's own separate dataset, so `language=en` on this request doesn't
    // guarantee it either. This is the field actually shown in the search dropdown, so it's the
    // one users see the Kannada road-name problem on in practice.
    return data.predictions.map((p) => ({ placeId: p.place_id, description: stripNonLatinSegments(p.description) }));
  }

  /** Resolves a `placeId` from `placeAutocomplete` into coordinates (Place Details), then runs
   * it straight through `reverseGeocodeGoogle` — the same City/Area resolution a dropped pin
   * gets, so the caller can treat "picked a search result" and "dropped a pin" identically.
   * `null` means Google couldn't resolve the place (expired/invalid id) — the caller's own
   * concern to handle, same as an empty `reverseGeocodeGoogle` result. */
  async resolvePlaceId(placeId: string): Promise<PlaceGeocodeResultDto | null> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_SERVER_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Location lookup is not configured on this server yet');
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${apiKey}`;
    const maskedUrl = maskUrlParam(url, 'key');
    const res = await fetch(url);
    const responseText = await res.text();
    if (!res.ok) {
      this.logger.warn(`Google Place Details API request failed: ${res.status}`);
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'google-maps',
        method: 'placeDetails',
        url: maskedUrl,
        request: { placeId },
        status: res.status,
        responseText,
        ok: false,
      });
      throw new ServiceUnavailableException('Failed to look up that place');
    }

    const data = JSON.parse(responseText) as GooglePlaceDetailsResponse;
    const location = data.result?.geometry?.location;
    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'google-maps',
      method: 'placeDetails',
      url: maskedUrl,
      request: { placeId },
      status: res.status,
      responseText,
      ok: data.status === 'OK' && !!location,
    });
    if (data.status !== 'OK' || !location) {
      this.logger.warn(
        `Google Place Details API returned ${data.status} for ${placeId}${data.error_message ? `: ${data.error_message}` : ''}`,
      );
      return null;
    }

    const reverse = await this.reverseGeocodeGoogle(location.lat, location.lng);
    return { ...reverse, lat: location.lat, lng: location.lng };
  }

  /**
   * Proxies the Google Static Maps API rather than handing the mobile app a URL to call directly
   * (the way the website does with its own browser-exposed `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`) —
   * the Static Maps API only supports HTTP-referrer/IP-address key restrictions, neither of which
   * means anything for a distributed app binary with no fixed referrer or client IP, so a key
   * usable there could not be safely restricted the way an "Android/iOS app" key restriction
   * would. Keeping the key server-side and returning the image bytes directly avoids ever
   * shipping it in the app bundle. Web keeps using its own key/URL unchanged — it already works
   * and a browser page genuinely can enforce a referrer restriction. */
  async getStaticMapImage(lat: number, lng: number): Promise<{ buffer: Buffer; contentType: string }> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_SERVER_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Map preview is not configured on this server yet');
    }

    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: '15',
      size: '640x200',
      scale: '2', // retina-sharp on a phone without doubling the requested tile size itself
      markers: `color:0x0b3d2e|${lat},${lng}`,
      key: apiKey,
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`);
    if (!res.ok) {
      this.logger.warn(`Google Static Maps API request failed: ${res.status}`);
      throw new ServiceUnavailableException('Failed to load the map preview');
    }

    return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/png' };
  }
}
