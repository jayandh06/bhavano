/** Flat ceiling for every account, no per-tier concept — unlike video (see videoLimits.ts),
 * nothing in the app elevates a seller's photo count today. Enforced both client-side (the
 * wizard hides "+ Add" past this) and server-side (ListingsService.create/addPhoto). */
export const MAX_PHOTOS = 6;

/** Floor enforced at creation only (ListingsService.create and both wizards' pre-submit check) —
 * a listing already live with fewer, from before this floor existed, keeps them; deletePhoto is
 * deliberately left unrestricted (see its own doc comment), so an existing listing can still be
 * edited down below this without the edit flow itself blocking it. */
export const MIN_PHOTOS = 3;

/** Enforced by multer, configured before any request or user is known — same reasoning as
 * MAX_VIDEO_BYTES. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** Photo count per tier — the photo counterpart to VIDEO_LIMITS. `default` is `MAX_PHOTOS`; a
 * Featured (boosted) listing or an Agent/Broker Pro owner can hold more. Only the *count* is tiered:
 * the byte cap stays flat (`MAX_PHOTO_BYTES`) because the web wizard already shrinks every photo to a
 * 2560px JPEG under it, which is larger than the biggest stored variant. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
export const PHOTO_LIMITS = {
  default: { maxPhotos: MAX_PHOTOS },
  elevated: { maxPhotos: 12 },
} as const;

export interface PhotoEntitlement {
  maxPhotos: number;
  /** True only on the default tier, when boosting *this* listing would lift the cap — drives the
   * "Featured ads can add up to 12 photos" copy. False for an already-elevated listing/owner. */
  canUpgradeByBoosting: boolean;
}

function isActive(until: Date | string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now();
}

/** Mirrors resolveVideoEntitlement: elevated if the owner holds an active Agent/Broker Pro
 * subscription OR the listing is currently boosted. Used by write paths only (addPhoto) — read paths
 * never filter existing photos by entitlement, so a lapsed boost keeps what was already added and
 * only stops new photos above the default cap. */
export function resolvePhotoEntitlement(
  user: { agentProUntil?: Date | string | null },
  listing?: { boostedUntil?: Date | string | null } | null,
): PhotoEntitlement {
  const elevated = isActive(user.agentProUntil) || isActive(listing?.boostedUntil);
  return elevated
    ? { ...PHOTO_LIMITS.elevated, canUpgradeByBoosting: false }
    : { ...PHOTO_LIMITS.default, canUpgradeByBoosting: true };
}
