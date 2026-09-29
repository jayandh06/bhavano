import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  decodeRequirementFeedQuery,
  type RequirementFeedDto,
  type RequirementFeedSummaryDto,
} from '@bhavano/types/requirementFeed';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { RequirementFeedService } from './requirement-feed.service';

/** Throttled so one account can't walk every filter combination and copy the demand map. */
@Controller('requirements/feed')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class RequirementFeedController {
  constructor(private readonly feedService: RequirementFeedService) {}

  @Get()
  @UseGuards(AuthGuard)
  feed(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUser() user: RequestUser,
  ): Promise<RequirementFeedDto> {
    return this.feedService.feed(user, decodeRequirementFeedQuery(query));
  }

  /** Public: counts only, no cards. */
  @Get('summary')
  summary(@Query('city') cityId?: string): Promise<RequirementFeedSummaryDto> {
    return this.feedService.summary(
      typeof cityId === 'string' && cityId ? cityId : undefined,
    );
  }
}
