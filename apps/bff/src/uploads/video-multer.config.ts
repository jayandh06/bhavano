import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { MAX_VIDEO_BYTES } from '@bhavano/types/videoLimits';
import { videoTmpDir } from './video-upload.guard-rails';

const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/x-matroska',
  // Real-world Android/Safari pickers send this for a variety of actual video containers — this
  // MIME whitelist is only a first-pass filter, ffprobe (see video-processing/ffmpeg.ts) is the
  // authoritative validator.
  'application/octet-stream',
];

/** Shared Multer config for every video-file upload endpoint (the wizard's pre-creation upload
 * and the post-creation add-video endpoint). `diskStorage`, not `memoryStorage`: holding a file
 * up to `MAX_VIDEO_BYTES` in a Buffer plus the AWS SDK's own internal copy would be too much RSS
 * on this box, and ffprobe/ffmpeg want a file path anyway. `MAX_VIDEO_BYTES` is a single flat
 * ceiling rather than per-tier — see its doc comment in packages/types/src/videoLimits.ts for why
 * a per-tier byte cap can't be expressed at the layer (Multer's `FileInterceptor`) that would
 * need to enforce it; tier is enforced on duration instead, checked after ffprobe runs. */
export function videoMulterOptions() {
  return {
    storage: diskStorage({
      destination: (_req: unknown, _file: unknown, cb: (error: Error | null, destination: string) => void) =>
        cb(null, videoTmpDir()),
      filename: (_req: unknown, _file: unknown, cb: (error: Error | null, filename: string) => void) =>
        cb(null, `${randomUUID()}.upload`),
    }),
    limits: { fileSize: MAX_VIDEO_BYTES },
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, acceptFile: boolean) => void) => {
      if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
        cb(new BadRequestException('Unsupported video file type'), false);
        return;
      }
      cb(null, true);
    },
  };
}
