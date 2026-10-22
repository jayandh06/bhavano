import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ListingsService } from './listings.service';

/** Puts held-back ads live once their time has come: the free ads posted while Admin → Posted
 * confirmation has "keep the ad off the site" on. Every minute, so an ad is never more than about
 * a minute late. See docs/plans/scheduled-go-live.md. */
@Injectable()
export class ScheduledPublishJob {
  private readonly logger = new Logger(ScheduledPublishJob.name);
  private running = false;

  constructor(private readonly listings: ListingsService) {}

  @Cron('* * * * *')
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const published = await this.listings.publishDueScheduled();
      if (published > 0) this.logger.log(`Put ${published} scheduled ad(s) live`);
    } catch (error) {
      this.logger.error('Scheduled publish sweep failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
