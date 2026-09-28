import { MAX_PHOTO_BYTES } from "@bhavano/types/photoLimits";

/** Photos at or under this are uploaded untouched — already quick to send, nothing to gain. */
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;

/** Tried in order until the JPEG fits MAX_PHOTO_BYTES. The first step already keeps more detail
 * than any variant the BFF stores (PHOTO_VARIANTS' largest is 1600px wide), so a seller never
 * sees a difference; the later steps only exist for pathological inputs. */
const ATTEMPTS: readonly (readonly [longEdge: number, quality: number])[] = [
  [2560, 0.85],
  [2048, 0.8],
  [1600, 0.75],
];

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

/**
 * Resizes and re-encodes a phone-sized photo to a JPEG under the upload limit, so a 6-10 MB camera
 * photo is accepted instead of refused. EXIF orientation is applied while decoding, and the output
 * carries no EXIF at all (location included). GIFs are left alone (re-encoding would drop the
 * animation), and anything the browser can't decode is returned as-is for the caller's own
 * type/size checks to handle.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size <= SHRINK_ABOVE_BYTES) return file;
  const bitmap = await decode(file);
  if (!bitmap) return file;
  try {
    for (const [longEdge, quality] of ATTEMPTS) {
      const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) return file;
      // JPEG has no alpha — a transparent PNG would otherwise come out on black.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob || blob.size > MAX_PHOTO_BYTES) continue;
      if (blob.size >= file.size) return file;
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    }
    return file;
  } finally {
    bitmap.close();
  }
}
