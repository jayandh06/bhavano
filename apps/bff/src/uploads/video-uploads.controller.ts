import { Body, Controller, BadRequestException, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { CreatedVideoInput } from '@bhavano/types';
import { resolveVideoEntitlement } from '@bhavano/types/videoLimits';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { RequestUser } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { ingestUploadedVideo } from './video-ingest';
import { UploadVideoDto } from './dto/upload-video.dto';
import { videoMulterOptions } from './video-multer.config';
import { assertDiskSpaceAvailable, videoTmpDir, withVideoUploadSlot } from './video-upload.guard-rails';

@Controller('uploads')
export class VideoUploadsController {
  constructor(
    private readonly storage: R2StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Wizard-time video upload — mirrors POST /uploads for photos: runs before the listing exists
   * (the client's pre-minted listingId), stores only the original to R2, creates no DB row.
   * ListingVideo rows are created later, either by ListingsService.create() (this path) or
   * addVideo() (POST /listings/:id/videos, a separate single-request endpoint for adding a video
   * to an already-existing listing — see docs/plans/listing-video-uploads.md for why the two
   * paths differ). */
  @Post('video')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', videoMulterOptions()))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadVideoDto,
    @CurrentUser() user: RequestUser,
  ): Promise<CreatedVideoInput> {
    if (!file) throw new BadRequestException('No file uploaded');

    return withVideoUploadSlot(async () => {
      assertDiskSpaceAvailable(videoTmpDir());

      // Entitlement is always resolved without a listing here: this endpoint only ever runs
      // before the listing exists (a listing can't be boosted before it's created), so only an
      // active Agent Pro subscription can elevate the duration limit at this point.
      // ListingsService.create() re-checks and silently trims once the listing does exist.
      const owner = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { agentProUntil: true },
      });
      const entitlement = resolveVideoEntitlement(owner);

      return ingestUploadedVideo(this.storage, file, dto.listingId, entitlement.maxDurationSec);
    });
  }
}
