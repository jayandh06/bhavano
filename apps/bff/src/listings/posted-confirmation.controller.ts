import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { RequestUser } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PostedConfirmationService } from './posted-confirmation.service';

@Controller('listings')
export class PostedConfirmationController {
  constructor(private readonly confirmations: PostedConfirmationService) {}

  /** The wizard reached the live screen (Featured paid, skipped or cancelled): send the held-back
   * "your ad is posted" message now rather than waiting out the delay. Idempotent. */
  @Post(':id/posted-confirmation')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async release(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<{ success: true }> {
    await this.confirmations.release(id, user.id);
    return { success: true };
  }
}
