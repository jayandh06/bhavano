import { BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    city: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-city', ...data })),
    },
    area: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-area', ...data })),
    },
    localityAlias: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as unknown as PrismaService;

  const config = { get: jest.fn().mockReturnValue('test-google-maps-key') } as unknown as ConfigService;
  const callLogger = { info: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
  const service = new LocationsService(prisma, config, callLogger);
  return { service, prisma, config, callLogger };
}

/** A minimal Google Geocoding API response carrying just the address_components
 * `reverseGeocodeGoogle` reads — real responses carry many more fields it never looks at. */
function mockGeocodeFetch(components: { types: string[]; long_name: string }[]): void {
  const body = JSON.stringify({
    status: 'OK',
    results: [
      {
        formatted_address: components.map((c) => c.long_name).join(', '),
        address_components: components.map((c) => ({ ...c, short_name: c.long_name })),
      },
    ],
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('LocationsService.ensureCity — refuses a name that would produce an unreachable URL', () => {
  it('creates a new city when the name slugifies to something usable', async () => {
    const { service, prisma } = makeService();

    const city = await service.ensureCity('Nashik', 'Maharashtra', 20, 73);

    expect(city).not.toBeNull();
    expect(prisma.city.create).toHaveBeenCalled();
  });

  it('declines rather than create a city whose name is entirely non-Latin script', async () => {
    // Real incident: Google's Geocoding API returned "मुंबई"/"महाराष्ट्र" for a dropped pin
    // instead of "Mumbai"/"Maharashtra" (the request had no `language` param at the time).
    // slugify("मुंबई") is "" — every URL built from that city (buildListingPath's
    // `/${citySlug}/...`) had an empty first segment, which a browser resolves as
    // protocol-relative to a bogus host instead of a same-site path, making the listing under it
    // permanently unreachable.
    const { service, prisma } = makeService();

    const city = await service.ensureCity('मुंबई', 'महाराष्ट्र', 19.06, 73.07);

    expect(city).toBeNull();
    expect(prisma.city.create).not.toHaveBeenCalled();
  });

  it('still declines on a same-slug collision with an existing city (pre-existing behavior)', async () => {
    const { service, prisma } = makeService({
      city: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ id: 'existing', name: 'Mumbai', state: 'Maharashtra' }]),
        create: jest.fn(),
      },
    });

    const city = await service.ensureCity('mumbai', 'Some Other State', 19, 72);

    expect(city).toBeNull();
    expect(prisma.city.create).not.toHaveBeenCalled();
  });
});

describe('LocationsService.ensureArea — refuses a name that would produce an unreachable URL', () => {
  it('creates a new area when the name slugifies to something usable', async () => {
    const { service, prisma } = makeService();

    const area = await service.ensureArea('city1', 'Sector 30, Kharghar');

    expect(area).toMatchObject({ name: 'Sector 30, Kharghar' });
    expect(prisma.area.create).toHaveBeenCalled();
  });

  it('rejects an area name entirely in a non-Latin script', async () => {
    const { service, prisma } = makeService();

    await expect(service.ensureArea('city1', 'आणंद नगर')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.area.create).not.toHaveBeenCalled();
  });
});

describe('LocationsService.reverseGeocodeGoogle — city stays the curated market', () => {
  afterEach(() => jest.restoreAllMocks());

  const coimbatore = {
    id: 'coimbatore-1',
    name: 'Coimbatore',
    state: 'Tamil Nadu',
    source: 'curated',
    lat: 11.0168,
    lng: 76.9558,
    catchmentKm: 25,
  };

  const delhiNcr = {
    id: 'delhi-ncr',
    name: 'Delhi NCR',
    state: 'Delhi',
    source: 'curated',
    lat: 28.7041,
    lng: 77.1025,
    catchmentKm: 50,
  };

  function serviceWithCurated(cities: object[]) {
    return makeService({
      city: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(cities),
        create: jest.fn(),
      },
    });
  }

  it('an admin-patched LocalityAlias wins and does not look up cities', async () => {
    const { service, prisma } = makeService({
      localityAlias: { findFirst: jest.fn().mockResolvedValue({ city: coimbatore }) },
    });
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'New Siddhapudur' },
      { types: ['locality'], long_name: 'New Siddhapudur' },
      { types: ['administrative_area_level_2'], long_name: 'Coimbatore' },
      { types: ['administrative_area_level_1'], long_name: 'Tamil Nadu' },
    ]);

    const result = await service.reverseGeocodeGoogle(11.03, 76.96);

    expect(result.cityId).toBe('coimbatore-1');
    expect(result.isNewCity).toBe(false);
    expect(prisma.city.findMany).not.toHaveBeenCalled();
    expect(prisma.city.create).not.toHaveBeenCalled();
  });

  it('matches a curated city when the district is named on a later geocode result', async () => {
    const { service, prisma } = serviceWithCurated([coimbatore]);
    const body = JSON.stringify({
      status: 'OK',
      results: [
        {
          formatted_address: 'New Siddhapudur, Tamil Nadu',
          address_components: [
            { types: ['sublocality', 'sublocality_level_1'], long_name: 'New Siddhapudur', short_name: 'New Siddhapudur' },
            { types: ['locality'], long_name: 'New Siddhapudur', short_name: 'New Siddhapudur' },
            { types: ['administrative_area_level_1'], long_name: 'Tamil Nadu', short_name: 'TN' },
          ],
        },
        {
          formatted_address: 'Coimbatore, Tamil Nadu',
          address_components: [
            { types: ['locality'], long_name: 'Coimbatore', short_name: 'Coimbatore' },
            { types: ['administrative_area_level_2'], long_name: 'Coimbatore', short_name: 'Coimbatore' },
            { types: ['administrative_area_level_1'], long_name: 'Tamil Nadu', short_name: 'TN' },
          ],
        },
      ],
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(body),
    }) as unknown as typeof fetch;

    const result = await service.reverseGeocodeGoogle(11.03, 76.96);

    expect(result.cityId).toBe('coimbatore-1');
    expect(result.resolvedLocality).toBe('New Siddhapudur');
    expect(prisma.city.create).not.toHaveBeenCalled();
    expect(prisma.area.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'New Siddhapudur', cityId: 'coimbatore-1' }) }),
    );
  });

  it('strips a trailing direction or Urban qualifier before matching the district', async () => {
    const { service, prisma } = serviceWithCurated([
      { ...coimbatore, lat: 0, lng: 0 },
    ]);
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'New Siddhapudur' },
      { types: ['locality'], long_name: 'New Siddhapudur' },
      { types: ['administrative_area_level_2'], long_name: 'Coimbatore North' },
      { types: ['administrative_area_level_1'], long_name: 'Tamil Nadu' },
    ]);

    const result = await service.reverseGeocodeGoogle(11.03, 76.96);

    expect(result.cityId).toBe('coimbatore-1');
    expect(result.isNewCity).toBe(false);
    expect(prisma.city.create).not.toHaveBeenCalled();
  });

  it('keeps a ward inside the catchment on the curated city even when Google never names that city', async () => {
    const { service, prisma } = serviceWithCurated([coimbatore]);
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'Saravanampatti' },
      { types: ['locality'], long_name: 'Saravanampatti' },
      { types: ['administrative_area_level_1'], long_name: 'Tamil Nadu' },
    ]);

    const result = await service.reverseGeocodeGoogle(11.08, 77.0);

    expect(result.cityId).toBe('coimbatore-1');
    expect(result.cityName).toBe('Coimbatore');
    expect(result.resolvedLocality).toBe('Saravanampatti');
    expect(prisma.city.create).not.toHaveBeenCalled();
    expect(prisma.city.findFirst).not.toHaveBeenCalled();
  });

  it('does not create a city when the pin is outside every catchment', async () => {
    const { service, prisma } = serviceWithCurated([coimbatore]);
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'Some New Ward' },
      { types: ['locality'], long_name: 'Some Uncovered Town' },
      { types: ['administrative_area_level_2'], long_name: 'Some Uncovered District' },
      { types: ['administrative_area_level_1'], long_name: 'Some State' },
    ]);

    const result = await service.reverseGeocodeGoogle(20, 80);

    expect(result.cityId).toBeUndefined();
    expect(result.isNewCity).toBe(false);
    expect(result.resolvedLocality).toBe('Some New Ward');
    expect(prisma.city.create).not.toHaveBeenCalled();
    expect(prisma.area.create).not.toHaveBeenCalled();
  });

  it('files a Noida pin under Delhi NCR because the pin is inside that catchment', async () => {
    const { service, prisma } = serviceWithCurated([delhiNcr, coimbatore]);
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'Sector 62' },
      { types: ['locality'], long_name: 'Noida' },
      { types: ['administrative_area_level_2'], long_name: 'Gautam Buddha Nagar' },
      { types: ['administrative_area_level_1'], long_name: 'Uttar Pradesh' },
    ]);

    const result = await service.reverseGeocodeGoogle(28.6139, 77.3728);

    expect(result.cityId).toBe('delhi-ncr');
    expect(result.resolvedLocality).toBe('Sector 62');
    expect(prisma.city.create).not.toHaveBeenCalled();
  });
});
