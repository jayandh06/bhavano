import { spawn } from 'node:child_process';
import { setPriority } from 'node:os';
import { VIDEO_TRANSCODE } from '../uploads/video-keys';

const PROBE_TIMEOUT_MS = 15_000;
const TRANSCODE_TIMEOUT_MS = 240_000;
/** Absolute sanity ceiling regardless of tier — a crafted container can lie about its own
 * duration in metadata, so this bounds actual ffmpeg work independent of what ffprobe reported. */
const ABSOLUTE_MAX_DURATION_SEC = 120;

export class VideoProbeError extends Error {}
export class FfmpegError extends Error {}

interface SpawnResult {
  stdout: string;
  stderrTail: string;
}

/** Runs a child process, capturing stdout fully and only the tail of stderr (ffmpeg is verbose on
 * stderr even at -loglevel error for some inputs — capping avoids an unbounded buffer). Kills with
 * SIGKILL on timeout: ffmpeg/ffprobe can hang uninterruptibly inside a demuxer on a malformed
 * input, and SIGTERM isn't reliably honored there. Lowers the child's scheduling priority so a
 * transcode never starves the Node event loop on the box's 2 vCPUs. */
function run(bin: string, args: string[], timeoutMs: number): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      setPriority(child.pid!, 10);
    } catch {
      // Best-effort — some sandboxes disallow this; the timeout + SIGKILL below is the real guard.
    }

    let stdout = '';
    let stderrTail = '';
    const STDERR_TAIL_MAX = 4000;
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-STDERR_TAIL_MAX);
    });

    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderrTail });
      } else {
        reject(new Error(`${bin} exited with code ${code}: ${stderrTail}`));
      }
    });
  });
}

interface FfprobeStream {
  codec_type: string;
  duration?: string;
}
interface FfprobeOutput {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

export interface ProbeResult {
  durationSec: number;
}

/** Server-side duration verification — the tier-enforcement mechanism, so a client-reported
 * duration is never trusted. Also rejects anything with no actual video stream (an audio file or
 * a plain image renamed with a video extension passes any MIME whitelist otherwise). */
export async function probeVideo(filePath: string): Promise<ProbeResult> {
  const { stdout } = await run(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    PROBE_TIMEOUT_MS,
  );

  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new VideoProbeError('Could not read this video file');
  }

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!videoStream) throw new VideoProbeError('No video stream found in the uploaded file');

  const formatDuration = Number(parsed.format?.duration ?? NaN);
  const streamDuration = Number(videoStream.duration ?? NaN);
  const durationSec = Math.ceil(Math.max(formatDuration || 0, streamDuration || 0));

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new VideoProbeError('Could not determine video duration');
  }
  if (durationSec > ABSOLUTE_MAX_DURATION_SEC) {
    throw new VideoProbeError(`Video is longer than the maximum allowed ${ABSOLUTE_MAX_DURATION_SEC}s`);
  }

  return { durationSec };
}

/** One ffmpeg invocation producing both the normalized playback file and a poster frame — a
 * single decode pass over the (potentially large) original rather than two, since both derive
 * from the same source. See docs/plans/listing-video-uploads.md for why each flag is there. */
export async function transcodeAndExtractPoster(
  inputPath: string,
  outputVideoPath: string,
  outputPosterPath: string,
  durationSec: number,
): Promise<void> {
  const posterTimestamp = Math.min(1, durationSec / 2);
  const { maxLongEdge, videoBitrateK, audioBitrateK, crf } = VIDEO_TRANSCODE;

  try {
    await run(
      'ffmpeg',
      [
        '-nostdin',
        '-y',
        '-loglevel',
        'error',
        '-nostats',
        '-i',
        inputPath,
        // Hard cap regardless of what ffprobe reported — belt-and-suspenders against a container
        // whose metadata disagrees with its actual stream length.
        '-t',
        String(ABSOLUTE_MAX_DURATION_SEC + 10),
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?', // '?' makes audio optional — silent walkthrough videos are common
        '-vf',
        `scale=w=${maxLongEdge}:h=${maxLongEdge}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        String(crf),
        '-maxrate',
        `${videoBitrateK}k`,
        '-bufsize',
        `${videoBitrateK * 2}k`,
        // 8-bit 4:2:0 main profile: trades a minor color shift on 10-bit/HDR iPhone HEVC sources
        // for universal <video> compatibility (Alpine's ffmpeg has no HDR tone-mapping).
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'main',
        '-level',
        '4.0',
        // Moves the moov atom to the front so playback can start before the whole file downloads.
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        `${audioBitrateK}k`,
        '-ac',
        '2',
        '-threads',
        '1',
        outputVideoPath,
        '-ss',
        String(posterTimestamp),
        '-frames:v',
        '1',
        '-update',
        '1',
        outputPosterPath,
      ],
      TRANSCODE_TIMEOUT_MS,
    );
  } catch (err) {
    throw new FfmpegError(err instanceof Error ? err.message : String(err));
  }
}
