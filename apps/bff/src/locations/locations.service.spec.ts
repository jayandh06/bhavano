import { BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

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
    ...overrides,
  } as unknown as PrismaService;

  const service = new LocationsService(prisma, {} as ConfigService);
  return { service, prisma };
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
