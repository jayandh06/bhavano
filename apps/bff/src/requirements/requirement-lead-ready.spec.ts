import type { PrismaService } from '../prisma/prisma.service';
import { countFittingRequirements } from './requirement-lead-ready';

/** A requirement row with just enough fields for `criteriaOf` / `isLeadReady`. */
function row(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    seekerId: 'seeker',
    status: 'open',
    category: 'apartment',
    transactionType: 'rent',
    cityId: 'c1',
    areaIds: ['a1'],
    bedroomOptions: [2],
    minPrice: 20000,
    maxPrice: 30000,
    minAreaSqft: null,
    maxAreaSqft: null,
    areaUnit: null,
    attributes: {},
    moveInBy: null,
    city: { id: 'c1', name: 'Bengaluru' },
    ...over,
  };
}

function prismaWith(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  return { prisma: { requirement: { findMany } } as unknown as PrismaService, findMany };
}

const listing = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  cityId: 'c1',
  areaId: 'a1',
  category: 'apartment' as const,
  transactionType: 'rent' as const,
  ...over,
});

describe('countFittingRequirements', () => {
  it('counts requirements with the same city, category, transaction and area', async () => {
    const { prisma } = prismaWith([row({ id: 'r1' }), row({ id: 'r2' })]);
    const counts = await countFittingRequirements(prisma, 'owner', [listing()]);
    expect(counts.get('l1')).toBe(2);
  });

  it('leaves out an ad that nothing fits', async () => {
    const { prisma } = prismaWith([row({ areaIds: ['other'] }), row({ category: 'house' }), row({ transactionType: 'sell' })]);
    const counts = await countFittingRequirements(prisma, 'owner', [listing()]);
    expect(counts.has('l1')).toBe(false);
  });

  it('treats buy and sell as the same transaction', async () => {
    const { prisma } = prismaWith([row({ transactionType: 'buy' })]);
    const counts = await countFittingRequirements(prisma, 'owner', [listing({ transactionType: 'sell' })]);
    expect(counts.get('l1')).toBe(1);
  });

  it("excludes the owner's own requirements in the query", async () => {
    const { prisma, findMany } = prismaWith([]);
    await countFittingRequirements(prisma, 'owner-1', [listing()]);
    expect(findMany.mock.calls[0][0].where.seekerId).toEqual({ not: 'owner-1' });
  });

  it('does not query at all when the owner has no matchable ads', async () => {
    const { prisma, findMany } = prismaWith([]);
    expect((await countFittingRequirements(prisma, 'owner', [])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
