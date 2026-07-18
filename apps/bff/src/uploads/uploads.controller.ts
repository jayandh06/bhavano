import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import { R2StorageService } from '../storage/r2-storage.service';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { extFromMimeType, originalKey } from './photo-keys';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

/** 64-bit difference-hash (dHash): resize to 9x8 grayscale and compare adjacent pixels
 * per row. Cheap, dependency-light perceptual hash — good enough to catch identical or
 * lightly-recompressed duplicate photo submissions via Hamming-distance comparison. */
async function computeDHash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let row = 0; row < info.height; row++) {
    for (let col = 0; col < info.width - 1; col++) {
      const left = data[row * info.width + col];
      const right = data[row * info.width + col + 1];
      bits += left < right ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: R2StorageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPhotoDto,
  ): Promise<{ hash: string; ext: string }> {
    if (!file) throw new BadRequestException('No file uploaded');

    const hash = await computeDHash(file.buffer);
    const ext = extFromMimeType(file.mimetype);
    await this.storage.putObject(originalKey(dto.listingId, dto.photoNo, ext), file.buffer, file.mimetype);

    // Resized variants are generated asynchronously once the listing is actually created
    // (ListingsService.create() enqueues the PhotoVariantJob rows) — not here, so abandoning
    // the wizard mid-upload never wastes worker cycles on a listing that's never posted.
    return { hash, ext };
  }
}
