import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { originalKey, PHOTO_VARIANTS, PhotoVariant, variantKey } from '../uploads/photo-keys';

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 3000;

@Injectable()
export class PhotoProcessingService {
  private readonly logger = new Logger(PhotoProcessingService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async processPending(): Promise<void> {
    // The interval fires on a fixed schedule regardless of how long the previous run took —
    // skip overlapping runs rather than letting them pile up.
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.prisma.photoVariantJob.findMany({
        where: { status: 'pending' },
        take: BATCH_SIZE,
      });

      for (const job of jobs) {
        await this.prisma.photoVariantJob.update({ where: { id: job.id }, data: { status: 'processing' } });
        try {
          const original = await this.storage.getObject(originalKey(job.listingId, job.photoNo, job.ext));
          const { width, quality } = PHOTO_VARIANTS[job.variant as PhotoVariant];
          const resized = await sharp(original)
            .resize(width, null, { withoutEnlargement: true })
            .webp({ quality })
            .toBuffer();
          await this.storage.putObject(
            variantKey(job.listingId, job.photoNo, job.variant as PhotoVariant),
            resized,
            'image/webp',
          );
          await this.prisma.photoVariantJob.update({ where: { id: job.id }, data: { status: 'done' } });
        } catch (error) {
          const attempts = job.attempts + 1;
          this.logger.warn(`Photo variant job ${job.id} failed (attempt ${attempts}): ${error}`);
          await this.prisma.photoVariantJob.update({
            where: { id: job.id },
            data: {
              attempts,
              status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
