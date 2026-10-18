import { Body, Controller, Get, Header, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import type {
  AdminAreaOverviewDetail,
  AdminAreaOverviewsPage,
  AreaOverviewDto,
  AreaOverviewStatus,
} from '@bhavano/types/areaOverview';
import { AdminGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { AreaOverviewsService } from './area-overviews.service';
import { SaveAreaOverviewDto } from './dto/save-area-overview.dto';
import { SetAreaOverviewStatusDto } from './dto/set-area-overview-status.dto';

/** Public read of a published overview. Drafts and in-review text are never returned. */
@Controller('area-overviews')
export class AreaOverviewsPublicController {
  constructor(private readonly overviews: AreaOverviewsService) {}

  @Get(':areaId')
  @Header('Cache-Control', 'public, max-age=300')
  getPublished(@Param('areaId') areaId: string): Promise<AreaOverviewDto | null> {
    return this.overviews.getPublished(areaId);
  }
}

@Controller('admin/area-overviews')
@UseGuards(AdminGuard)
export class AreaOverviewsAdminController {
  constructor(private readonly overviews: AreaOverviewsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminAreaOverviewsPage> {
    const allowed = ['draft', 'in_review', 'published', 'none'];
    return this.overviews.list({
      status: status && allowed.includes(status) ? (status as AreaOverviewStatus | 'none') : undefined,
      q,
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(100, Math.max(1, Number(limit) || 25)),
    });
  }

  @Get(':areaId')
  get(@Param('areaId') areaId: string): Promise<AdminAreaOverviewDetail> {
    return this.overviews.getForAdmin(areaId);
  }

  @Put(':areaId')
  save(
    @Param('areaId') areaId: string,
    @Body() dto: SaveAreaOverviewDto,
    @CurrentUser() user: RequestUser,
  ): Promise<AreaOverviewDto> {
    return this.overviews.save(areaId, dto, user.id);
  }

  @Patch(':areaId/status')
  setStatus(
    @Param('areaId') areaId: string,
    @Body() dto: SetAreaOverviewStatusDto,
    @CurrentUser() user: RequestUser,
  ): Promise<AreaOverviewDto> {
    return this.overviews.setStatus(areaId, dto.status, dto.checklistConfirmed === true, user.id);
  }
}
