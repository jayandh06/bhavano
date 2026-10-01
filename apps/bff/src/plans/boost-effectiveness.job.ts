import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BoostEffectivenessStatService } from './boost-effectiveness.service';

/** Nightly recompute of the boosted-vs-unboosted comparison — see BoostEffectivenessStatService's
 * own doc comment and docs/plans/boost-recovery-dialog.md. Low-traffic hour, no particular reason
 * it needs to be fresher than once a day: the dialog it feeds is gated on a 10-listing minimum per
 * cohort, so it moves slowly by nature. */
@Injectable()
export class BoostEffectivenessJob {
  private readonly logger = new Logger(BoostEffectivenessJob.name);

  constructor(private readonly stats: BoostEffectivenessStatService) {}

  @Cron('30 2 * * *', { timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    try {
      await this.stats.computeAndStore();
    } catch (error) {
      this.logger.error('Boost effectiveness recompute failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
