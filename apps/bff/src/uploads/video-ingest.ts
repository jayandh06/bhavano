import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { CreatedVideoInput } from '@bhavano/types';
import { R2StorageService } from '../storage/r2-storage.service';
import { probeVideo, VideoProbeError } from '../video-processing/ffmpeg';
import { extFromVideoMimeType, videoOriginalKey } from './video-keys';

/** Shared by both video upload entry points (the wizard's pre-creation `POST /uploads/video` and
 * the post-creation `POST /listings/:id/videos`): validates duration via ffprobe (never trusts a
 * client-reported value, since duration is the tier-enforcement mechanism), stores the original
 * to R2 under a freshly-minted opaque `storageId`, and always cleans up the local temp file
 * regardless of outcome. Callers are responsible for resolving `maxDurationSec` from the caller's
 * actual entitlement (with or without a listing — see resolveVideoEntitlement). */
export async function ingestUploadedVideo(
  storage: R2StorageService,
  file: Express.Multer.File,
  listingId: string,
  maxDurationSec: number,
): Promise<CreatedVideoInput> {
  try {
    const probe = await probeVideo(file.path).catch((err: unknown) => {
      if (err instanceof VideoProbeError) throw new BadRequestException(err.message);
      throw err;
    });
    if (probe.durationSec > maxDurationSec) {
      throw new BadRequestException(`This video is longer than the ${maxDurationSec}s limit for your account`);
    }

    const storageId = randomUUID();
    const ext = extFromVideoMimeType(file.mimetype);
    await storage.putObjectStream(videoOriginalKey(listingId, storageId, ext), file.path, file.mimetype);

    return { storageId, ext, durationSec: probe.durationSec, sizeBytes: file.size };
  } finally {
    await unlink(file.path).catch(() => undefined);
  }
}
