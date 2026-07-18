export type PhotoVariant = 'preview' | 'full';

/** Variant width/quality — the whole config, so adding a third variant later is a one-line
 * change here rather than a design change (see docs/plans/photo-uploads-r2-cdn.md). */
export const PHOTO_VARIANTS: Record<PhotoVariant, { width: number; quality: number }> = {
  preview: { width: 480, quality: 70 },
  full: { width: 1600, quality: 82 },
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function extFromMimeType(mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) throw new Error(`Unsupported mime type: ${mimeType}`);
  return ext;
}

/** Never exposed via any DTO — used only as the resize source by the photo-processing worker. */
export function originalKey(listingId: string, photoNo: number, ext: string): string {
  return `photos/${listingId}_${photoNo}_original.${ext}`;
}

/** Variants are always re-encoded to WebP regardless of the source format, so the key never
 * needs to know the original extension. */
export function variantKey(listingId: string, photoNo: number, variant: PhotoVariant): string {
  return `photos/${listingId}_${photoNo}_${variant}.webp`;
}

export function variantUrl(cdnBase: string, listingId: string, photoNo: number, variant: PhotoVariant): string {
  return `${cdnBase}/${variantKey(listingId, photoNo, variant)}`;
}
