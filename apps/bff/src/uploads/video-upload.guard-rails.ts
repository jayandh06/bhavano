import { ServiceUnavailableException } from '@nestjs/common';
import { mkdirSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_CONCURRENT_VIDEO_UPLOADS = 2;
const MIN_FREE_DISK_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

/** Reuses the already-created-but-otherwise-unused /app/apps/bff/uploads dir (a leftover from
 * the pre-R2 local-disk era) in production, given a dedicated named volume there (see
 * docker-compose.prod.yml) — falls back to the OS temp dir locally. */
export function videoTmpDir(): string {
  const dir = process.env.VIDEO_TMP_DIR ?? join(tmpdir(), 'bhavano-video-tmp');
  mkdirSync(dir, { recursive: true });
  return dir;
}

let activeUploads = 0;

/** In-process semaphore bounding concurrent video uploads/transcode-triggering requests — matches
 * the codebase's existing single-instance assumption (PhotoProcessingService's in-memory
 * `running` flag sets the same precedent). Large video uploads consume disk + CPU (ffprobe) per
 * request; unbounded concurrency could exhaust the shared 20-30GB root volume documented in
 * docs/deployment.md. */
export async function withVideoUploadSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeUploads >= MAX_CONCURRENT_VIDEO_UPLOADS) {
    throw new ServiceUnavailableException('Too many video uploads in progress — please try again shortly');
  }
  activeUploads++;
  try {
    return await fn();
  } finally {
    activeUploads--;
  }
}

/** Rejects before doing any real work if the temp volume is close to full — that volume is
 * shared with Docker images, Loki, Grafana, and BFF logs (docs/deployment.md), so an unbounded
 * video upload could otherwise take the whole instance down, not just this feature. */
export function assertDiskSpaceAvailable(dir: string): void {
  const stats = statfsSync(dir);
  const freeBytes = stats.bavail * stats.bsize;
  if (freeBytes < MIN_FREE_DISK_BYTES) {
    throw new ServiceUnavailableException('Server storage is temporarily full — please try again later');
  }
}
