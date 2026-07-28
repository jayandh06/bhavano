import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { videoOriginalKey, videoPosterKey, videoTranscodedKey, POSTER_QUALITY, POSTER_WIDTH } from '../uploads/video-keys';
import { videoTmpDir } from '../uploads/video-upload.guard-rails';
import { transcodeAndExtractPoster } from './ffmpeg';

// Photos poll every 3s; transcoding is far more CPU-expensive on this box's 2 vCPUs, so this is
// deliberately slower and serialized (batch of 1) rather than photo-processing's batch of 5.
const POLL_INTERVAL_MS = 10_000;
const BATCH_SIZE = 1;
// Fewer retries than photos (5) — a transcode failure is typically a deterministic bad/corrupt
// input, so extra attempts mostly just burn CPU credits rather than recover anything.
const MAX_ATTEMPTS = 3;

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async processPending(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.prisma.listingVideo.findMany({
        where: { status: 'pending' },
        take: BATCH_SIZE,
      });

      for (const job of jobs) {
        await this.processOne(job);
      }
    } finally {
      this.running = false;
    }
  }

  private async processOne(job: { id: string; listingId: string; storageId: string; ext: string; durationSec: number; attempts: number }): Promise<void> {
    await this.prisma.listingVideo.update({ where: { id: job.id }, data: { status: 'processing' } });

    const tmpDir = videoTmpDir();
    const originalPath = join(tmpDir, `${randomUUID()}_original.${job.ext}`);
    const transcodedPath = join(tmpDir, `${randomUUID()}_transcoded.mp4`);
    const posterPath = join(tmpDir, `${randomUUID()}_poster.png`);

    try {
      await this.storage.getObjectToFile(videoOriginalKey(job.listingId, job.storageId, job.ext), originalPath);
      await transcodeAndExtractPoster(originalPath, transcodedPath, posterPath, job.durationSec);

      // Reuse the already-used `sharp` for the poster's final WebP encode, same as photo variants
      // — avoids needing a webp encoder path in ffmpeg itself.
      const posterWebp = await sharp(posterPath).resize(POSTER_WIDTH, null, { withoutEnlargement: true }).webp({ quality: POSTER_QUALITY }).toBuffer();

      await this.storage.putObjectStream(videoTranscodedKey(job.listingId, job.storageId), transcodedPath, 'video/mp4');
      await this.storage.putObject(videoPosterKey(job.listingId, job.storageId), posterWebp, 'image/webp');

      await this.prisma.listingVideo.update({ where: { id: job.id }, data: { status: 'done', error: null } });
    } catch (error) {
      const attempts = job.attempts + 1;
      this.logger.warn(`Video ${job.id} processing failed (attempt ${attempts}): ${error}`);
      await this.prisma.listingVideo.update({
        where: { id: job.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      await Promise.all([
        unlink(originalPath).catch(() => undefined),
        unlink(transcodedPath).catch(() => undefined),
        unlink(posterPath).catch(() => undefined),
      ]);
    }
  }
}
