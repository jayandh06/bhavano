import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import sharp from 'sharp';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** 64-bit difference-hash (dHash): resize to 9x8 grayscale and compare adjacent pixels
 * per row. Cheap, dependency-light perceptual hash — good enough to catch identical or
 * lightly-recompressed duplicate photo submissions via Hamming-distance comparison. */
async function computeDHash(filePath: string): Promise<string> {
  const { data, info } = await sharp(filePath)
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

// TEMP(auth-gate): local-disk storage stands in for the PRD's S3/R2 target until that's wired up.
@Controller('uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image uploads are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<{ url: string; hash: string }> {
    if (!file) throw new BadRequestException('No file uploaded');
    const hash = await computeDHash(file.path);
    return { url: `/uploads/${file.filename}`, hash };
  }
}
