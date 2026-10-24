import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserCityFromIpService } from './user-city-from-ip.service';

/** Once a day, gives accounts that skipped the city question an approximate one from their visit
 * IPs (marked `cityFromIp`). See docs/plans/profile-city-from-ip.md. */
@Injectable()
export class UserCityFromIpJob {
  private readonly logger = new Logger(UserCityFromIpJob.name);
  private running = false;

  constructor(private readonly cities: UserCityFromIpService) {}

  @Cron('10 4 * * *', { timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const filled = await this.cities.fillMissingCities();
      if (filled > 0) this.logger.log(`Filled a city from IP for ${filled} account(s)`);
    } catch (error) {
      this.logger.error('City-from-IP job failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
