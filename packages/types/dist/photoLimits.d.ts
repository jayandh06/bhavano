/** Flat ceiling for every account, no per-tier concept — unlike video (see videoLimits.ts),
 * nothing in the app elevates a seller's photo count today. Enforced both client-side (the
 * wizard hides "+ Add" past this) and server-side (ListingsService.create/addPhoto). */
export declare const MAX_PHOTOS = 6;
/** Floor enforced at creation only (ListingsService.create and both wizards' pre-submit check) —
 * a listing already live with fewer, from before this floor existed, keeps them; deletePhoto is
 * deliberately left unrestricted (see its own doc comment), so an existing listing can still be
 * edited down below this without the edit flow itself blocking it. */
export declare const MIN_PHOTOS = 3;
/** Enforced by multer, configured before any request or user is known — same reasoning as
 * MAX_VIDEO_BYTES. */
export declare const MAX_PHOTO_BYTES: number;
/** Photo count per tier — the photo counterpart to VIDEO_LIMITS. `default` is `MAX_PHOTOS`; a
 * Featured (boosted) listing or an Agent/Broker Pro owner can hold more. Only the *count* is tiered:
 * the byte cap stays flat (`MAX_PHOTO_BYTES`) because the web wizard already shrinks every photo to a
 * 2560px JPEG under it, which is larger than the biggest stored variant. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
export declare const PHOTO_LIMITS: {
    readonly default: {
        readonly maxPhotos: 6;
    };
    readonly elevated: {
        readonly maxPhotos: 12;
    };
};
export interface PhotoEntitlement {
    maxPhotos: number;
    /** True only on the default tier, when boosting *this* listing would lift the cap — drives the
     * "Featured ads can add up to 12 photos" copy. False for an already-elevated listing/owner. */
    canUpgradeByBoosting: boolean;
}
/** Mirrors resolveVideoEntitlement: elevated if the owner holds an active Agent/Broker Pro
 * subscription OR the listing is currently boosted. Used by write paths only (addPhoto) — read paths
 * never filter existing photos by entitlement, so a lapsed boost keeps what was already added and
 * only stops new photos above the default cap. */
export declare function resolvePhotoEntitlement(user: {
    agentProUntil?: Date | string | null;
}, listing?: {
    boostedUntil?: Date | string | null;
} | null): PhotoEntitlement;
