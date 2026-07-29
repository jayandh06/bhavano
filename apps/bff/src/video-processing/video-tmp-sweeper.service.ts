import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { videoTmpDir } from '../uploads/video-upload.guard-rails';

const SWEEP_INTERVAL_MS = 600_000; // 10 minutes
const MAX_FILE_AGE_MS = 30 * 60 * 1000; // 30 minutes

/** Deletes any leftover video temp file older than 30 minutes — the crash-only backstop for
 * temp files that survive a request (upload handler crash, container restart mid-transcode). The
 * request/worker code paths already clean up their own temp files in `finally` blocks; this exists
 * only to recover disk space when one of those didn't get the chance to run. Runs once at module
 * init too, since a prior container instance's leftovers matter just as much as this one's. */
@Injectable()
export class VideoTmpSweeperService implements OnModuleInit {
  private readonly logger = new Logger(VideoTmpSweeperService.name);

  async onModuleInit(): Promise<void> {
    await this.sweep();
  }

  @Interval(SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    const dir = videoTmpDir();
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }

    const now = Date.now();
    for (const name of names) {
      const filePath = join(dir, name);
      try {
        const stats = await stat(filePath);
        if (now - stats.mtimeMs > MAX_FILE_AGE_MS) {
          await unlink(filePath);
          this.logger.warn(`Swept stale video temp file: ${name}`);
        }
      } catch {
        // Already gone, or a transient stat error — either way, nothing to do.
      }
    }
  }
}
