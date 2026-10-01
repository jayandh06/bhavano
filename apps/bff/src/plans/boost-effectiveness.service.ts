import { Injectable, Logger } from '@nestjs/common';
import type { BoostEffectivenessDto } from '@bhavano/types/boostEffectiveness';
import { PrismaService } from '../prisma/prisma.service';
import { BOOST_EFFECTIVENESS_STAT_ID } from './plans.constants';

const WINDOW_DAYS = 7;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

interface Cohort {
  views: number[];
  contacted: number;
  total: number;
}

/**
 * Computes and caches the boosted-vs-unboosted comparison behind the post-ad preview step's
 * recovery dialog (docs/plans/boost-recovery-dialog.md). Nightly, not per-request — the query
 * touches every eligible listing's full view/interest history, not something to pay for on every
 * dialog render.
 *
 * "Boosted" means `boostedUntil` was ever set (has been boosted at some point), not that the
 * boost was active during the measured 7-day window specifically — a reasonable approximation
 * given sample sizes here are already the limiting factor (see MIN_SAMPLE_SIZE), not worth the
 * extra complexity of tracking exact boost-period overlap.
 */
@Injectable()
export class BoostEffectivenessStatService {
  private readonly logger = new Logger(BoostEffectivenessStatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<BoostEffectivenessDto | null> {
    const row = await this.prisma.boostEffectivenessStat.findUnique({
      where: { id: BOOST_EFFECTIVENESS_STAT_ID },
    });
    if (!row) return null;
    return {
      avgViews7dBoosted: row.avgViews7dBoosted,
      avgViews7dUnboosted: row.avgViews7dUnboosted,
      contactRate7dBoosted: row.contactRate7dBoosted,
      contactRate7dUnboosted: row.contactRate7dUnboosted,
      boostedSampleSize: row.boostedSampleSize,
      unboostedSampleSize: row.unboostedSampleSize,
      computedAt: row.computedAt.toISOString(),
    };
  }

  /** Exposed for the nightly job and for a one-off manual run; returns what it computed. */
  async computeAndStore(now = new Date()): Promise<BoostEffectivenessDto> {
    const windowComplete = new Date(now.getTime() - WINDOW_MS);

    const listings = await this.prisma.listing.findMany({
      where: { publishState: 'live', createdAt: { lte: windowComplete } },
      select: { id: true, createdAt: true, boostedUntil: true },
    });

    const ids = listings.map((l) => l.id);
    const [views, interests] = await Promise.all([
      this.prisma.listingView.findMany({
        where: { listingId: { in: ids } },
        select: { listingId: true, createdAt: true },
      }),
      this.prisma.listingInterest.findMany({
        where: { listingId: { in: ids } },
        select: { listingId: true, createdAt: true },
      }),
    ]);

    const viewsByListing = new Map<string, Date[]>();
    for (const v of views) {
      const arr = viewsByListing.get(v.listingId);
      if (arr) arr.push(v.createdAt);
      else viewsByListing.set(v.listingId, [v.createdAt]);
    }
    const interestsByListing = new Map<string, Date[]>();
    for (const i of interests) {
      const arr = interestsByListing.get(i.listingId);
      if (arr) arr.push(i.createdAt);
      else interestsByListing.set(i.listingId, [i.createdAt]);
    }

    const boosted: Cohort = { views: [], contacted: 0, total: 0 };
    const unboosted: Cohort = { views: [], contacted: 0, total: 0 };

    for (const listing of listings) {
      const windowEnd = new Date(listing.createdAt.getTime() + WINDOW_MS);
      const inWindow = (d: Date) => d >= listing.createdAt && d < windowEnd;

      const viewCount = (viewsByListing.get(listing.id) ?? []).filter(inWindow).length;
      const wasContacted = (interestsByListing.get(listing.id) ?? []).some(inWindow);

      const cohort = listing.boostedUntil ? boosted : unboosted;
      cohort.views.push(viewCount);
      cohort.total += 1;
      if (wasContacted) cohort.contacted += 1;
    }

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const rate = (c: Cohort) => (c.total ? c.contacted / c.total : 0);

    const stats: BoostEffectivenessDto = {
      avgViews7dBoosted: avg(boosted.views),
      avgViews7dUnboosted: avg(unboosted.views),
      contactRate7dBoosted: rate(boosted),
      contactRate7dUnboosted: rate(unboosted),
      boostedSampleSize: boosted.total,
      unboostedSampleSize: unboosted.total,
      computedAt: now.toISOString(),
    };

    await this.prisma.boostEffectivenessStat.upsert({
      where: { id: BOOST_EFFECTIVENESS_STAT_ID },
      create: {
        id: BOOST_EFFECTIVENESS_STAT_ID,
        avgViews7dBoosted: stats.avgViews7dBoosted,
        avgViews7dUnboosted: stats.avgViews7dUnboosted,
        contactRate7dBoosted: stats.contactRate7dBoosted,
        contactRate7dUnboosted: stats.contactRate7dUnboosted,
        boostedSampleSize: stats.boostedSampleSize,
        unboostedSampleSize: stats.unboostedSampleSize,
      },
      update: {
        avgViews7dBoosted: stats.avgViews7dBoosted,
        avgViews7dUnboosted: stats.avgViews7dUnboosted,
        contactRate7dBoosted: stats.contactRate7dBoosted,
        contactRate7dUnboosted: stats.contactRate7dUnboosted,
        boostedSampleSize: stats.boostedSampleSize,
        unboostedSampleSize: stats.unboostedSampleSize,
      },
    });

    this.logger.log(
      `Boost effectiveness recomputed: boosted=${stats.boostedSampleSize} unboosted=${stats.unboostedSampleSize}`,
    );
    return stats;
  }
}
