import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Rotates which currently-boosted listings sit at the very top of the boosted tier, rather
 * than whoever bought the longest/most-recent boost permanently squatting position #1 — see
 * the "rotating boost" differentiator in
 * docs/plans/monetization-boosted-listings-premium-tiers.md. `Listing.boostRank` (not
 * `boostedUntil`) is what `listings.service.ts`'s ORDER_BY actually sorts on for this reason:
 * a non-null value means "currently in the featured tier," and its magnitude is meaningless
 * outside of being re-shuffled here periodically. */
const ROTATION_INTERVAL_MS = 30 * 60 * 1000;

@Injectable()
export class BoostRotationService {
  private readonly logger = new Logger(BoostRotationService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Interval(ROTATION_INTERVAL_MS)
  async rotate(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();

      // Expired boosts drop out of the featured tier immediately, rather than waiting for
      // their stale boostRank to lose the next reshuffle.
      await this.prisma.listing.updateMany({
        where: { boostRank: { not: null }, boostedUntil: { lte: now } },
        data: { boostRank: null },
      });

      const active = await this.prisma.listing.findMany({
        where: { boostedUntil: { gt: now } },
        select: { id: true },
      });
      await Promise.all(
        active.map((listing) => this.prisma.listing.update({ where: { id: listing.id }, data: { boostRank: Math.random() } })),
      );

      if (active.length > 0) this.logger.log(`Rotated boost rank for ${active.length} listing(s)`);
    } catch (error) {
      this.logger.error('Boost rotation failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
