import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type {
  AdminAreaOverviewDetail,
  AdminAreaOverviewsPage,
  AreaOverviewDto,
  AreaOverviewStatus,
  BulkAreaOverviewResult,
  PublishedAreaOverviewLink,
} from '@bhavano/types/areaOverview';
import { AREA_OVERVIEW_SORT_FIELDS, type AreaOverviewSortField } from '@bhavano/types/areaOverview';
import { AdminGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { AreaOverviewsService } from './area-overviews.service';
import { SaveAreaOverviewDto } from './dto/save-area-overview.dto';
import { SetAreaOverviewStatusDto } from './dto/set-area-overview-status.dto';
import { BulkAreaOverviewStatusDto } from './dto/bulk-area-overview-status.dto';

/** Public read of a published overview. Drafts and in-review text are never returned. */
@Controller('area-overviews')
export class AreaOverviewsPublicController {
  constructor(private readonly overviews: AreaOverviewsService) {}

  /** Areas with a published overview, busiest first. Declared before `:areaId`. */
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  listPublished(@Query('limit') limit?: string): Promise<PublishedAreaOverviewLink[]> {
    return this.overviews.listPublished(Math.min(24, Math.max(1, Number(limit) || 12)));
  }

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
    @Query('city') city?: string,
    @Query('q') q?: string,
    @Query('updatedFrom') updatedFrom?: string,
    @Query('updatedTo') updatedTo?: string,
    @Query('minListings') minListings?: string,
    @Query('maxListings') maxListings?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminAreaOverviewsPage> {
    const allowed = ['draft', 'in_review', 'published', 'none'];
    const day = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
    const count = (value?: string) => (value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : undefined);
    return this.overviews.list({
      status: status && allowed.includes(status) ? (status as AreaOverviewStatus | 'none') : undefined,
      city,
      q,
      updatedFrom: day(updatedFrom),
      updatedTo: day(updatedTo),
      minListings: count(minListings),
      maxListings: count(maxListings),
      sort: AREA_OVERVIEW_SORT_FIELDS.includes(sort as AreaOverviewSortField) ? (sort as AreaOverviewSortField) : undefined,
      dir: dir === 'asc' ? 'asc' : 'desc',
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(100, Math.max(1, Number(limit) || 25)),
    });
  }

  /** Publish or unpublish many areas at once. Declared before the `:areaId` routes. */
  @Post('bulk-status')
  setStatusBulk(@Body() dto: BulkAreaOverviewStatusDto, @CurrentUser() user: RequestUser): Promise<BulkAreaOverviewResult> {
    return this.overviews.setStatusBulk(dto.areaIds, dto.status, dto.checklistConfirmed === true, user.id);
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
