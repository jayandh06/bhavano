import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { MyReferralsDto } from '@bhavano/types';
import { AuthGuard, type RequestUser } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { RecordReferralClickDto } from './dto/record-referral-click.dto';
import { RecordShareTapDto } from './dto/record-share-tap.dto';

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

  @Get('me')
  @UseGuards(AuthGuard)
  getMine(@CurrentUser() user: RequestUser): Promise<MyReferralsDto> {
    return this.referralsService.getMine(user.id);
  }

  /** Authenticated — the referrer tapping their own Share button. See
   * ReferralsService.recordShareTap's own doc comment. */
  @Post('share-tap')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async recordShareTap(@Body() dto: RecordShareTapDto, @CurrentUser() user: RequestUser): Promise<{ success: true }> {
    await this.referralsService.recordShareTap(user.id, dto.sessionId, dto.listingId, dto.channel);
    return { success: true };
  }
}
