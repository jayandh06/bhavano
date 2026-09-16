import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { RecordVisitDto } from './dto/record-visit.dto';
import { RecordPageViewDto } from './dto/record-pageview.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Public, unauthenticated — called for every anonymous visitor's first request of a browser
   * session, before any login has happened. Protected only by the app-wide default throttle
   * (20 req/60s/IP, see ThrottlerModule.forRoot in app.module.ts). */
  @Post('visit')
  @HttpCode(200)
  async recordVisit(@Body() dto: RecordVisitDto): Promise<{ success: true }> {
    await this.analyticsService.recordVisit(dto);
    return { success: true };
  }

  /** Public, unauthenticated — called on every real (non-prefetch) page navigation within a
   * session, not just the first, so the app-wide default (20/60s, shared with every other
   * endpoint that IP hits) would truncate an active browsing session's trail; raised well above
   * anything a real visitor's click rate could produce. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('pageview')
  @HttpCode(200)
  async recordPageView(@Body() dto: RecordPageViewDto): Promise<{ success: true }> {
    await this.analyticsService.recordPageView(dto);
    return { success: true };
  }
}
