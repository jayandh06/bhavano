import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { CampaignAnalyticsDto } from '@bhavano/types/campaignAnalytics';
import { AdminGuard } from '../auth/guards/auth.guard';
import { CampaignAnalyticsQueryDto } from './campaign-analytics.dto';
import { CampaignAnalyticsService } from './campaign-analytics.service';

/** Admin only: visits by campaign / ad group / ad / source / landing page, and what they did next. */
@Controller('admin/analytics')
@UseGuards(AdminGuard)
export class CampaignAnalyticsController {
  constructor(private readonly analytics: CampaignAnalyticsService) {}

  @Get('campaigns')
  campaigns(@Query() query: CampaignAnalyticsQueryDto): Promise<CampaignAnalyticsDto> {
    return this.analytics.report(query);
  }
}
