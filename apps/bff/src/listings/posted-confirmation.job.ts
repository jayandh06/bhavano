import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostedConfirmationService } from './posted-confirmation.service';

/** Sends the held-back "your ad is posted" message for sellers who never reached the live screen
 * (closed the tab on the Featured offer). Every 5 minutes; the wait itself is
 * the admin setting. */
@Injectable()
export class PostedConfirmationJob {
  private readonly logger = new Logger(PostedConfirmationJob.name);
  private running = false;

  constructor(private readonly confirmations: PostedConfirmationService) {}

  @Cron('*/5 * * * *')
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.confirmations.sendDue();
      if (sent > 0) this.logger.log(`Sent ${sent} delayed posted confirmation(s)`);
    } catch (error) {
      this.logger.error('Posted confirmation sweep failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
