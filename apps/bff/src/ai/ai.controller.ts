import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { GenerateListingCopyResult } from '@bhavano/types/listingCopyAssist';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitAction } from '../rate-limit/rate-limit-kind.decorator';
import { AiService } from './ai.service';
import { GenerateListingCopyDto } from './dto/generate-listing-copy.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('listing-copy')
  // AuthGuard, not OptionalAuthGuard: RateLimitGuard no-ops without a request.user.id, so an
  // anonymous caller would otherwise bypass rate limiting on a route with a real per-call cost.
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimitAction('ai_generate')
  generateListingCopy(
    @Body() dto: GenerateListingCopyDto,
    @CurrentUser() user: RequestUser,
  ): Promise<GenerateListingCopyResult> {
    return this.aiService.generate(dto, user.id);
  }
}
