import type { PrismaService } from '../prisma/prisma.service';
import { RequirementFeedService } from './requirement-feed.service';

const now = Date.now();
const city = { id: 'blr', name: 'Bengaluru' };

function requirement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    seekerId: 'seeker',
    cityId: 'blr',
    city,
    areaId: 'hsr',
    areaIds: ['hsr'],
    category: 'apartment',
    transactionType: 'rent',
    bedroomOptions: [2],
    minPrice: null,
    maxPrice: 30_000,
    minAreaSqft: null,
    maxAreaSqft: null,
    areaUnit: null,
    attributes: null,
    moveInBy: null,
    note: 'call me on 98xxxxxx',
    searchLabel: 'my own words',
    contactConsentAt: new Date(now),
    createdAt: new Date(now - 60_000),
    refinedAt: new Date(now - 60_000),
    ...overrides,
  };
}

function setup({
  sellerType = null as string | null,
  listings = [] as unknown[],
  rows = [requirement()],
} = {}) {
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ sellerType, agentProUntil: null }),
    },
    listing: { findMany: jest.fn().mockResolvedValue(listings) },
    requirement: { findMany: jest.fn().mockResolvedValue(rows) },
    area: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'hsr', name: 'HSR Layout' }]),
    },
  };
  return {
    prisma,
    service: new RequirementFeedService(prisma as unknown as PrismaService),
  };
}

describe('RequirementFeedService.feed', () => {
  it('shows nothing to someone who is not an owner or agent yet', async () => {
    const { service, prisma } = setup();
    const result = await service.feed({ id: 'u1', role: 'user' }, {});
    expect(result).toMatchObject({ eligible: false, items: [], total: 0 });
    expect(prisma.requirement.findMany).not.toHaveBeenCalled();
  });

  it('lets a declared owner or agent, a listing holder, or an admin in', async () => {
    expect(
      (
        await setup({ sellerType: 'agent' }).service.feed(
          { id: 'u1', role: 'user' },
          {},
        )
      ).eligible,
    ).toBe(true);
    const listing = {
      cityId: 'blr',
      areaId: 'hsr',
      category: 'apartment',
      transactionType: 'rent',
    };
    const holder = await setup({ listings: [listing] }).service.feed(
      { id: 'u1', role: 'user' },
      {},
    );
    expect(holder).toMatchObject({ eligible: true, hasListings: true });
    expect(holder.items[0].matchingListingCount).toBe(1);
    expect(
      (await setup().service.feed({ id: 'u1', role: 'admin' }, {})).eligible,
    ).toBe(true);
  });

  it("lists only lead-ready requirements, never the viewer's own, with no seeker words", async () => {
    const vague = requirement({ id: 'r2', areaIds: [], areaId: null });
    const { service, prisma } = setup({
      sellerType: 'owner',
      rows: [requirement(), vague],
    });
    const result = await service.feed({ id: 'u1', role: 'user' }, {});

    const [query] = prisma.requirement.findMany.mock.calls[0] as [
      { where: { seekerId: unknown } },
    ];
    expect(query.where.seekerId).toEqual({ not: 'u1' });
    expect(result.items.map((item) => item.id)).toEqual(['r1']);
    const card = result.items[0];
    expect(card.label).toContain('HSR Layout');
    expect(JSON.stringify(card)).not.toMatch(/98xxxxxx|my own words|seeker/);
    expect(card).toMatchObject({
      openToCalls: true,
      areaNames: ['HSR Layout'],
      budgetUnit: 'per month',
    });
    expect(result.facets).toEqual({
      cities: [{ cityId: 'blr', cityName: 'Bengaluru', count: 1 }],
      areas: [],
      intents: { rentLease: 1 },
      categories: { apartment: 1 },
    });
  });

  it('counts cities ignoring the city filter', async () => {
    const chennai = requirement({
      id: 'r3',
      cityId: 'chn',
      city: { id: 'chn', name: 'Chennai' },
    });
    const { service } = setup({
      sellerType: 'owner',
      rows: [requirement(), chennai],
    });
    const result = await service.feed(
      { id: 'u1', role: 'user' },
      { city: 'chn' },
    );
    expect(result.items.map((item) => item.id)).toEqual(['r3']);
    expect(result.facets.cities.map((c) => c.cityId).sort()).toEqual([
      'blr',
      'chn',
    ]);
    expect(result.facets.areas).toEqual([
      { areaId: 'hsr', name: 'HSR Layout', count: 1 },
    ]);
  });
});

describe('RequirementFeedService.summary', () => {
  it('returns counts only', async () => {
    const result = await setup().service.summary();
    expect(result).toEqual({
      total: 1,
      cities: [{ cityId: 'blr', cityName: 'Bengaluru', count: 1 }],
      types: [{ intent: 'rentLease', category: 'apartment', count: 1 }],
    });
  });
});
