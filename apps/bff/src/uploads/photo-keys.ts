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

/** The bare, canonical URL for a variant — this is the actual object identity in storage, and
 * the exact value CdnPurgeService purges. NOT what gets served to browsers (see
 * publicVariantUrl) — the bare URL is stable across a rotate, which is exactly the problem: it's
 * also stable across whatever CDN and Next.js's own image-optimizer cache already have. */
export function variantUrl(cdnBase: string, listingId: string, photoNo: number, variant: PhotoVariant): string {
  return `${cdnBase}/${variantKey(listingId, photoNo, variant)}`;
}

/** What ListingCardDto.photos / ListingDetailDto.photosFull actually put in front of a browser —
 * the canonical URL plus a cache-busting `?t=<ListingPhoto.updatedAt>`. Unrotated photos never
 * change this value, so caching stays exactly as effective as before for the overwhelming
 * majority of photos; a rotate bumps `updatedAt`, which changes this URL, which is a genuinely
 * new resource to both Cloudflare's edge and Next's own image-optimizer cache — neither of which
 * has any way to know the bare URL's *content* changed otherwise. `updatedAt` rather than
 * `rotation` for the same reason admin's own cache-buster uses it: `rotation` cycles back to 0,
 * which every photo starts at, so it isn't a safe cache key on its own. See
 * docs/plans/listing-photo-orientation.md. */
export function publicVariantUrl(
  cdnBase: string,
  listingId: string,
  photoNo: number,
  variant: PhotoVariant,
  updatedAt: Date,
): string {
  return `${variantUrl(cdnBase, listingId, photoNo, variant)}?t=${updatedAt.getTime()}`;
}
