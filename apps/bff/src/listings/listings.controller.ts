import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ListingDetailDto, ListingSitemapEntry, ListingsPage, PopularSearchDto } from '@bhavano/types';
import { VIDEO_LIMITS } from '@bhavano/types/videoLimits';
import { AuthGuard, OptionalAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimitAction } from '../rate-limit/rate-limit-kind.decorator';
import { videoMulterOptions } from '../uploads/video-multer.config';
import { assertDiskSpaceAvailable, videoTmpDir, withVideoUploadSlot } from '../uploads/video-upload.guard-rails';
import { ingestUploadedVideo } from '../uploads/video-ingest';
import { R2StorageService } from '../storage/r2-storage.service';
import { ListingsService } from './listings.service';
import { ListListingsDto } from './dto/list-listings.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { RecordViewDto } from './dto/record-view.dto';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly storage: R2StorageService,
  ) {}

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

  // Also registered before ":id" — see the comment on "sitemap" above.
  @Get('popular-searches')
  popularSearches(@Query('cityId') cityId?: string): Promise<PopularSearchDto[]> {
    return this.listingsService.getPopularSearches(undefined, cityId);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user?: RequestUser): Promise<ListingDetailDto> {
    return this.listingsService.findOne(id, user);
  }

  @Post()
  @UseGuards(AuthGuard, RateLimitGuard)
  @RateLimitAction('publish')
  create(@Body() dto: CreateListingDto, @CurrentUser() user: RequestUser): Promise<ListingDetailDto> {
    return this.listingsService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingDetailDto> {
    return this.listingsService.update(id, user.id, dto);
  }

  @Post(':id/view')
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimitAction('view')
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

  /** Adds a video to an already-existing listing — a single multipart request, unlike photos'
   * upload-then-attach two-step (see docs/plans/listing-video-uploads.md for why: the split only
   * pays for itself while the listing doesn't exist yet, which is never true here). The tier-
   * specific duration/count check happens in ListingsService.addVideo() once the real listing
   * (and, for an individual seller, its boost status) is known — ffprobe here only enforces the
   * absolute ceiling, not the caller's actual entitlement. */
  @Post(':id/videos')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', videoMulterOptions()))
  addVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingDetailDto> {
    if (!file) throw new BadRequestException('No file uploaded');

    return withVideoUploadSlot(async () => {
      assertDiskSpaceAvailable(videoTmpDir());
      const ingested = await ingestUploadedVideo(this.storage, file, id, VIDEO_LIMITS.elevated.maxDurationSec);
      return this.listingsService.addVideo(id, user.id, ingested);
    });
  }

  @Delete(':id/videos/:videoId')
  @UseGuards(AuthGuard)
  deleteVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingDetailDto> {
    return this.listingsService.deleteVideo(id, user.id, videoId);
  }
}
