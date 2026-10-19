import { Body, Controller, Get, Header, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import type {
  AdminCityOverviewDetail,
  AdminCityOverviewsPage,
  AreaOverviewStatus,
  CityOverviewDto,
} from '@bhavano/types/areaOverview';
import { AdminGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { SaveAreaOverviewDto } from '../area-overviews/dto/save-area-overview.dto';
import { SetAreaOverviewStatusDto } from '../area-overviews/dto/set-area-overview-status.dto';
import { CityOverviewsService } from './city-overviews.service';

/** Public read of a published city overview. Drafts and in-review text are never returned. */
@Controller('city-overviews')
export class CityOverviewsPublicController {
  constructor(private readonly overviews: CityOverviewsService) {}

  @Get(':cityId')
  @Header('Cache-Control', 'public, max-age=300')
  getPublished(@Param('cityId') cityId: string): Promise<CityOverviewDto | null> {
    return this.overviews.getPublished(cityId);
  }
}

@Controller('admin/city-overviews')
@UseGuards(AdminGuard)
export class CityOverviewsAdminController {
  constructor(private readonly overviews: CityOverviewsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminCityOverviewsPage> {
    const allowed = ['draft', 'in_review', 'published', 'none'];
    return this.overviews.list({
      status: status && allowed.includes(status) ? (status as AreaOverviewStatus | 'none') : undefined,
      q,
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(100, Math.max(1, Number(limit) || 50)),
    });
  }

  @Get(':cityId')
  get(@Param('cityId') cityId: string): Promise<AdminCityOverviewDetail> {
    return this.overviews.getForAdmin(cityId);
  }

  @Put(':cityId')
  save(@Param('cityId') cityId: string, @Body() dto: SaveAreaOverviewDto, @CurrentUser() user: RequestUser): Promise<CityOverviewDto> {
    return this.overviews.save(cityId, dto, user.id);
  }

  @Patch(':cityId/status')
  setStatus(
    @Param('cityId') cityId: string,
    @Body() dto: SetAreaOverviewStatusDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CityOverviewDto> {
    return this.overviews.setStatus(cityId, dto.status, dto.checklistConfirmed === true, user.id);
  }
}
