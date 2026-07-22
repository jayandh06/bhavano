import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from '../storage/r2-storage.service';
import { originalKey, PHOTO_VARIANTS, PhotoVariant, variantKey } from '../uploads/photo-keys';
import { BHAVANO_LOGO_PNG_BASE64 } from './watermark-logo';

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 3000;

/** Bottom-right corner mark: the Bhavano logo + wordmark, both scaled off the actual output
 * width so it reads consistently on the small 480px preview and the 1600px full variant alike.
 * A single full-canvas SVG (not two separate composite layers) so the logo and text stay
 * pixel-locked to each other regardless of how sharp positions composite inputs. */
function buildWatermarkSvg(width: number, height: number): Buffer {
  const margin = Math.round(width * 0.03);
  const logoSize = Math.round(width * 0.11);
  const logoX = width - margin - logoSize;
  const logoY = height - margin - logoSize;
  const fontSize = Math.round(width * 0.045);
  const textGap = Math.round(width * 0.015);
  const textY = logoY + logoSize / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g opacity="0.82">
      <text x="${logoX - textGap}" y="${textY}" text-anchor="end" dominant-baseline="middle"
            font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700"
            fill="#ffffff" stroke="#000000" stroke-opacity="0.45" stroke-width="${Math.max(1, fontSize * 0.05)}"
            paint-order="stroke">Bhavano</text>
      <image href="data:image/png;base64,${BHAVANO_LOGO_PNG_BASE64}"
             x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" />
    </g>
  </svg>`;

  return Buffer.from(svg);
}

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
          const { data: resizedRaw, info } = await sharp(original)
            .resize(width, null, { withoutEnlargement: true })
            .toBuffer({ resolveWithObject: true });
          const watermark = buildWatermarkSvg(info.width, info.height);
          const resized = await sharp(resizedRaw)
            .composite([{ input: watermark, top: 0, left: 0 }])
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
