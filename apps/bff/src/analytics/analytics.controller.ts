import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RecordVisitDto } from './dto/record-visit.dto';

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
}
