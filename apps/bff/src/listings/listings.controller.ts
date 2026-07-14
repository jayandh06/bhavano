import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { ListingDetailDto, ListingSitemapEntry, ListingsPage } from '@bhavano/types';
import { AuthGuard, OptionalAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { ListingsService } from './listings.service';
import { ListListingsDto } from './dto/list-listings.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { RecordViewDto } from './dto/record-view.dto';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: ListListingsDto, @CurrentUser() user?: RequestUser): Promise<ListingsPage> {
    return this.listingsService.list(query, user?.id);
  }

  // Registered before ":id" so it isn't swallowed by that param route.
  @Get('sitemap')
  sitemap(): Promise<ListingSitemapEntry[]> {
    return this.listingsService.findAllForSitemap();
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user?: RequestUser): Promise<ListingDetailDto> {
    return this.listingsService.findOne(id, user?.id);
  }

  @Post()
  // TEMP(auth-gate): posting is open without login for now — anonymous owner used until auth is re-enabled.
  create(@Body() dto: CreateListingDto): Promise<ListingDetailDto> {
    return this.listingsService.create(dto);
  }

  @Post(':id/view')
  @UseGuards(OptionalAuthGuard)
  recordView(
    @Param('id') id: string,
    @Body() dto: RecordViewDto,
    @CurrentUser() user?: RequestUser,
  ): Promise<{ viewCount: number }> {
    // Logged-in viewers dedupe by their real user id (consistent across devices);
    // anonymous viewers dedupe by the client-persisted key they send.
    return this.listingsService.recordView(id, user ? `user:${user.id}` : `anon:${dto.viewerKey}`);
  }

  @Post(':id/favourite')
  @UseGuards(AuthGuard)
  toggleFavourite(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ favourited: boolean; likeCount: number }> {
    return this.listingsService.toggleFavourite(id, user.id);
  }
}
