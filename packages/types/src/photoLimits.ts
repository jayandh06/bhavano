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
