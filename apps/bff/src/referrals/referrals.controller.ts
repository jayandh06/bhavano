import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { RecordReferralClickDto } from './dto/record-referral-click.dto';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  /** Public, unauthenticated — same stance as AnalyticsController's `/visit`/`/pageview`: called
   * for an anonymous visitor who just opened a shared referral link, before any login exists.
   * Protected only by the app-wide default throttle (see ThrottlerModule.forRoot in
   * app.module.ts). */
  @Post('click')
  @HttpCode(200)
  async recordClick(@Body() dto: RecordReferralClickDto): Promise<{ success: true }> {
    await this.referralsService.recordClick(dto.referralCode, dto.sessionId, dto.landingListingId);
    return { success: true };
  }
}
