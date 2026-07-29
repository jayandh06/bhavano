export const VIDEO_LIMITS = {
  default: { maxVideos: 1, maxDurationSec: 30 },
  elevated: { maxVideos: 3, maxDurationSec: 120 },
} as const;

/** Flat ceiling regardless of tier — enforced by multer, which is configured before any request
 * or user is known, so a per-tier byte cap can't be expressed at that layer. Tier is enforced on
 * duration (the actual product rule) instead; this just bounds abuse. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/** Per-user daily cap on video *uploads* (not videos attached to a listing) — the only thing
 * bounding R2 storage abuse via uploads that never get attached to a listing at all. */
export const MAX_VIDEO_UPLOADS_PER_DAY = 12;

export interface VideoEntitlement {
  maxVideos: number;
  maxDurationSec: number;
  /** Drives the "Boost this listing to add up to 3 videos…" upsell — true only when the caller
   * is on the default tier and boosting *this* listing would lift them. False for an active
   * Agent Pro subscriber (already elevated account-wide) and for an already-boosted listing. */
  canUpgradeByBoosting: boolean;
}

function isActive(until: Date | string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now();
}

/** Resolves the video tier for a poster — elevated if they hold an active Agent/Broker Pro
 * subscription OR (when checking against a real listing) that listing is currently boosted.
 * Pass `listing` undefined at wizard time: it doesn't exist yet, so only Agent Pro can elevate.
 *
 * This is the codebase's first isPremium()-shaped helper (every other tier check is an inline
 * `agentProUntil?.getTime() ?? 0 > Date.now()` at its call site) — keep its scope to video; don't
 * refactor the existing call sites to use it.
 *
 * Called only from write paths (upload, create, addVideo) — read paths (toDetailDto/toCardDto)
 * must never filter existing videos by entitlement. A lapsed subscription/boost never hides or
 * removes videos already added; it only stops new ones being added beyond the current tier. */
export function resolveVideoEntitlement(
  user: { agentProUntil?: Date | string | null },
  listing?: { boostedUntil?: Date | string | null } | null,
): VideoEntitlement {
  const elevated = isActive(user.agentProUntil) || isActive(listing?.boostedUntil);
  return elevated
    ? { ...VIDEO_LIMITS.elevated, canUpgradeByBoosting: false }
    : { ...VIDEO_LIMITS.default, canUpgradeByBoosting: true };
}
