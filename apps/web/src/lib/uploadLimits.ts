import { MAX_PHOTO_BYTES } from "@bhavano/types/photoLimits";
import { MAX_VIDEO_BYTES } from "@bhavano/types/videoLimits";

const MB = 1024 * 1024;

/** "4 MB" / "200 MB" — the per-file ceilings the BFF enforces, as shown next to every listing
 * photo/video picker so a seller knows before choosing, not after an upload is refused. */
export const PHOTO_SIZE_LABEL = `${Math.round(MAX_PHOTO_BYTES / MB)} MB`;
export const VIDEO_SIZE_LABEL = `${Math.round(MAX_VIDEO_BYTES / MB)} MB`;

export function photoTooLargeMessage(fileName: string): string {
  return `"${fileName}" is over the ${PHOTO_SIZE_LABEL} limit for a photo and couldn't be resized — try a different photo or a screenshot of it.`;
}

export function videoTooLargeMessage(fileName: string): string {
  return `"${fileName}" is over the ${VIDEO_SIZE_LABEL} limit for a video.`;
}
