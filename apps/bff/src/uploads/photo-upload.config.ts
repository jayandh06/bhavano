import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { MAX_PHOTO_BYTES } from '@bhavano/types/photoLimits';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Shared Multer config for every photo-file upload endpoint (the wizard's pre-creation
 * `/uploads` and the post-creation add-photo endpoint) — mirrors video-multer.config.ts's
 * videoMulterOptions() for the same reason (one config, so the two endpoints can't drift).
 * `memoryStorage`, not `diskStorage`: photos are capped at MAX_PHOTO_BYTES (4MB), small enough
 * to hold in a Buffer without the RSS concerns that make video use disk. */
export function imageFileInterceptorOptions() {
  return {
    storage: memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES },
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, acceptFile: boolean) => void) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
        return;
      }
      cb(null, true);
    },
  };
}
