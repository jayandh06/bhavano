import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ListingsService } from './listings.service';

/** Deletes admin-assisted listings their seller never claimed — see ASSISTED_CLAIM_DAYS. */
@Injectable()
export class AssistedListingExpiryJob {
  private readonly logger = new Logger(AssistedListingExpiryJob.name);
  private running = false;

  constructor(private readonly listingsService: ListingsService) {}

  @Cron('30 3 * * *', { timeZone: 'Asia/Kolkata' })
  async runDaily(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const deleted =
        await this.listingsService.deleteExpiredAssistedListings();
      if (deleted > 0)
        this.logger.log(`Deleted ${deleted} unclaimed assisted listing(s)`);
    } catch (error) {
      this.logger.error(
        'Assisted listing expiry job failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
