import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { SavedSearchDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { SavedSearchesService } from './saved-searches.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

@Controller('saved-searches')
@UseGuards(AuthGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

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
