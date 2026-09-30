import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { SavedSearchAllowanceDto, SavedSearchDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { SavedSearchesService } from './saved-searches.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

@Controller('saved-searches')
@UseGuards(AuthGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

  /** Backs the /saved-searches page's decision to show the create form or the upgrade prompt —
   * see SavedSearchesService.alertAllowance's own doc for why this has to be asked first rather
   * than assumed from subscription status alone (there is a free quota before Plus is required).
   * Declared before the bare `@Get()` list route only for readability; different path shapes
   * ('/saved-searches/allowance' vs '/saved-searches'), so declaration order can't shadow either. */
  @Get('allowance')
  async allowance(@CurrentUser() user: RequestUser): Promise<SavedSearchAllowanceDto> {
    const allowance = await this.savedSearchesService.alertAllowance(user.id);
    return allowance
      ? { canCreate: true, source: allowance.source, freeRemaining: allowance.freeRemaining }
      : { canCreate: false, freeRemaining: 0 };
  }

  @Post()
  create(@Body() dto: CreateSavedSearchDto, @CurrentUser() user: RequestUser): Promise<SavedSearchDto> {
    return this.savedSearchesService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<SavedSearchDto[]> {
    return this.savedSearchesService.list(user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<void> {
    return this.savedSearchesService.remove(id, user.id);
  }
}
