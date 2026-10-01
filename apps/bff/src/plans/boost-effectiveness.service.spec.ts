import { BoostEffectivenessStatService } from './boost-effectiveness.service';
import type { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T00:00:00Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS);
}

function makeService(opts: {
  listings: { id: string; createdAt: Date; boostedUntil: Date | null }[];
  views?: { listingId: string; createdAt: Date }[];
  interests?: { listingId: string; createdAt: Date }[];
}) {
  const upsert = jest.fn();
  const findUnique = jest.fn();
  const prisma = {
    listing: { findMany: jest.fn().mockResolvedValue(opts.listings) },
    listingView: { findMany: jest.fn().mockResolvedValue(opts.views ?? []) },
    listingInterest: { findMany: jest.fn().mockResolvedValue(opts.interests ?? []), upsert },
    boostEffectivenessStat: { upsert, findUnique },
  } as unknown as PrismaService;
  const service = new BoostEffectivenessStatService(prisma);
  return { service, prisma, upsert, findUnique };
}

describe('BoostEffectivenessStatService.computeAndStore', () => {
  it('only considers listings whose 7-day window has fully elapsed', async () => {
    const { service, prisma } = makeService({
      listings: [
        { id: 'too-new', createdAt: daysAgo(3), boostedUntil: null },
        { id: 'old-enough', createdAt: daysAgo(10), boostedUntil: null },
      ],
    });

    await service.computeAndStore(NOW);

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishState: 'live', createdAt: { lte: daysAgo(7) } },
      }),
    );
  });

  it('buckets by whether boostedUntil was ever set, and only counts views/interest within each listing\'s own first 7 days', async () => {
    const { service, upsert } = makeService({
      listings: [
        { id: 'boosted1', createdAt: daysAgo(10), boostedUntil: daysAgo(5) },
        { id: 'unboosted1', createdAt: daysAgo(10), boostedUntil: null },
      ],
      views: [
        // boosted1: 2 views inside its window, 1 outside (day 8 after creation — too late)
        { listingId: 'boosted1', createdAt: new Date(daysAgo(10).getTime() + 1 * DAY_MS) },
        { listingId: 'boosted1', createdAt: new Date(daysAgo(10).getTime() + 2 * DAY_MS) },
        { listingId: 'boosted1', createdAt: new Date(daysAgo(10).getTime() + 8 * DAY_MS) },
        // unboosted1: 1 view inside its window
        { listingId: 'unboosted1', createdAt: new Date(daysAgo(10).getTime() + 1 * DAY_MS) },
      ],
      interests: [{ listingId: 'boosted1', createdAt: new Date(daysAgo(10).getTime() + 3 * DAY_MS) }],
    });

    await service.computeAndStore(NOW);

    const data = upsert.mock.calls[0][0].create;
    expect(data.avgViews7dBoosted).toBe(2); // the day-8 view is outside the window, excluded
    expect(data.avgViews7dUnboosted).toBe(1);
    expect(data.contactRate7dBoosted).toBe(1); // 1 of 1 boosted listing contacted
    expect(data.contactRate7dUnboosted).toBe(0); // 0 of 1 unboosted listing contacted
    expect(data.boostedSampleSize).toBe(1);
    expect(data.unboostedSampleSize).toBe(1);
  });

  it('returns zeroed stats (not a crash) when there are no eligible listings yet', async () => {
    const { service } = makeService({ listings: [] });

    const stats = await service.computeAndStore(NOW);

    expect(stats).toEqual(
      expect.objectContaining({
        avgViews7dBoosted: 0,
        avgViews7dUnboosted: 0,
        contactRate7dBoosted: 0,
        contactRate7dUnboosted: 0,
        boostedSampleSize: 0,
        unboostedSampleSize: 0,
      }),
    );
  });
});

describe('BoostEffectivenessStatService.getStats', () => {
  it('returns null before the first nightly computation has ever run', async () => {
    const { service, findUnique } = makeService({ listings: [] });
    findUnique.mockResolvedValue(null);

    await expect(service.getStats()).resolves.toBeNull();
  });

  it('maps the cached row to the public DTO, including computedAt as an ISO string', async () => {
    const { service, findUnique } = makeService({ listings: [] });
    findUnique.mockResolvedValue({
      avgViews7dBoosted: 4,
      avgViews7dUnboosted: 2,
      contactRate7dBoosted: 0.5,
      contactRate7dUnboosted: 0.2,
      boostedSampleSize: 12,
      unboostedSampleSize: 40,
      computedAt: NOW,
    });

    await expect(service.getStats()).resolves.toEqual({
      avgViews7dBoosted: 4,
      avgViews7dUnboosted: 2,
      contactRate7dBoosted: 0.5,
      contactRate7dUnboosted: 0.2,
      boostedSampleSize: 12,
      unboostedSampleSize: 40,
      computedAt: NOW.toISOString(),
    });
  });
});
