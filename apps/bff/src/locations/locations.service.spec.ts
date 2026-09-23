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

describe('LocationsService.reverseGeocodeGoogle — city-resolution priority chain', () => {
  afterEach(() => jest.restoreAllMocks());

  // Real-world shape: a pin inside a Coimbatore ward Google tags with its own locality name,
  // but whose district (administrative_area_level_2) is still "Coimbatore" — see
  // docs/plans/fix-wrong-city-geocoding-locality-alias.md.
  const wardComponents = [
    { types: ['sublocality', 'sublocality_level_1'], long_name: 'New Siddhapudur' },
    { types: ['locality'], long_name: 'New Siddhapudur' },
    { types: ['administrative_area_level_2'], long_name: 'Coimbatore' },
    { types: ['administrative_area_level_1'], long_name: 'Tamil Nadu' },
  ];

  it('an admin-patched LocalityAlias wins over district/locality matching', async () => {
    const coimbatore = { id: 'coimbatore-1', name: 'Coimbatore', state: 'Tamil Nadu', source: 'curated' };
    const { service, prisma } = makeService({
      localityAlias: { findFirst: jest.fn().mockResolvedValue({ city: coimbatore }) },
    });
    mockGeocodeFetch(wardComponents);

    const result = await service.reverseGeocodeGoogle(11.03, 76.96);

    expect(result.cityId).toBe('coimbatore-1');
    expect(result.isNewCity).toBeFalsy();
    // Alias resolved it — the district/locality lookups below it in the chain should never run.
    expect(prisma.city.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to a district match against a curated city when no alias exists', async () => {
    const coimbatore = { id: 'coimbatore-1', name: 'Coimbatore', state: 'Tamil Nadu', source: 'curated' };
    const { service, prisma } = makeService({
      city: {
        findFirst: jest.fn().mockResolvedValueOnce(coimbatore),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    });
    mockGeocodeFetch(wardComponents);

    const result = await service.reverseGeocodeGoogle(11.03, 76.96);

    expect(result.cityId).toBe('coimbatore-1');
    expect(result.isNewCity).toBeFalsy();
    // Matched on the district, curated-only — never fell through to auto-create a "New
    // Siddhapudur" city, which is the exact bug this fix closes.
    expect(prisma.city.create).not.toHaveBeenCalled();
    expect(prisma.city.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'curated',
          name: { equals: 'Coimbatore', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('strips a trailing "Urban"/"Rural"/"District" qualifier before matching the district', async () => {
    const bengaluru = { id: 'blr-1', name: 'Bengaluru', state: 'Karnataka', source: 'curated' };
    const { service, prisma } = makeService({
      city: {
        findFirst: jest.fn().mockResolvedValueOnce(bengaluru),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    });
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'Koramangala' },
      { types: ['locality'], long_name: 'Bengaluru' },
      { types: ['administrative_area_level_2'], long_name: 'Bengaluru Urban' },
      { types: ['administrative_area_level_1'], long_name: 'Karnataka' },
    ]);

    const result = await service.reverseGeocodeGoogle(12.93, 77.62);

    expect(result.cityId).toBe('blr-1');
    expect(prisma.city.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: { equals: 'Bengaluru', mode: 'insensitive' } }),
      }),
    );
  });

  it('still auto-creates a new city when no alias, district, or locality match exists (unchanged behavior)', async () => {
    const { service, prisma } = makeService();
    mockGeocodeFetch([
      { types: ['sublocality', 'sublocality_level_1'], long_name: 'Some New Ward' },
      { types: ['locality'], long_name: 'Some Uncovered Town' },
      { types: ['administrative_area_level_2'], long_name: 'Some Uncovered District' },
      { types: ['administrative_area_level_1'], long_name: 'Some State' },
    ]);

    const result = await service.reverseGeocodeGoogle(20, 80);

    expect(result.isNewCity).toBe(true);
    expect(prisma.city.create).toHaveBeenCalled();
  });
});
