import { MAX_VIDEO_BYTES } from "@bhavano/types/videoLimits";

const MB = 1024 * 1024;

/** What a seller may pick. Photos are shrunk in the browser (lib/shrinkPhoto.ts) to fit the BFF's
 * 4 MB MAX_PHOTO_BYTES, so the figure shown is the camera-photo size that reliably resizes, not
 * the upload ceiling; a larger photo is still tried rather than refused. Videos aren't resized, so
 * theirs is the BFF's own ceiling. */
export const PHOTO_SIZE_LABEL = "10 MB";
export const VIDEO_SIZE_LABEL = `${Math.round(MAX_VIDEO_BYTES / MB)} MB`;

export function photoTooLargeMessage(fileName: string): string {
  return `"${fileName}" couldn't be made small enough to upload — try a different photo or a screenshot of it.`;
}

export function videoTooLargeMessage(fileName: string): string {
  return `"${fileName}" is over the ${VIDEO_SIZE_LABEL} limit for a video.`;
}
