export const VIDEO_TRANSCODE = {
  maxLongEdge: 1280,
  videoBitrateK: 1800,
  audioBitrateK: 96,
  crf: 26,
} as const;

export const POSTER_WIDTH = 720;
export const POSTER_QUALITY = 76;

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'video/x-matroska': 'mkv',
  // Real-world Android/Safari pickers send this for a variety of actual video containers —
  // ffprobe (not the MIME type) is the authoritative validator, so a generic extension is fine.
  'application/octet-stream': 'bin',
};

export function extFromVideoMimeType(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? 'bin';
}

/** Under its own `videos/originals/` prefix (unlike photos' flat `photos/` namespace) so an R2
 * object-lifecycle rule can expire originals by prefix (rules only filter on prefix) — see
 * docs/plans/listing-video-uploads.md. Never exposed via any DTO — used only as the
 * transcode/poster source by the video-processing worker. */
export function videoOriginalKey(listingId: string, storageId: string, ext: string): string {
  return `videos/originals/${listingId}/${storageId}.${ext}`;
}

/** Always re-encoded to H.264/AAC mp4 regardless of source container, so the key never needs to
 * know the original extension. `storageId`, not `videoNo`, is the only identifier here — see the
 * doc comment on ListingVideo.storageId for why. */
export function videoTranscodedKey(listingId: string, storageId: string): string {
  return `videos/${listingId}_${storageId}_720p.mp4`;
}

export function videoPosterKey(listingId: string, storageId: string): string {
  return `videos/${listingId}_${storageId}_poster.webp`;
}

export function videoUrl(cdnBase: string, listingId: string, storageId: string): string {
  return `${cdnBase}/${videoTranscodedKey(listingId, storageId)}`;
}

export function videoPosterUrl(cdnBase: string, listingId: string, storageId: string): string {
  return `${cdnBase}/${videoPosterKey(listingId, storageId)}`;
}
