"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_VIDEO_UPLOADS_PER_DAY = exports.MAX_VIDEO_BYTES = exports.VIDEO_LIMITS = void 0;
exports.resolveVideoEntitlement = resolveVideoEntitlement;
exports.VIDEO_LIMITS = {
    default: { maxVideos: 1, maxDurationSec: 30 },
    elevated: { maxVideos: 3, maxDurationSec: 120 },
};
/** Flat ceiling regardless of tier — enforced by multer, which is configured before any request
 * or user is known, so a per-tier byte cap can't be expressed at that layer. Tier is enforced on
 * duration (the actual product rule) instead; this just bounds abuse. */
exports.MAX_VIDEO_BYTES = 200 * 1024 * 1024;
/** Per-user daily cap on video *uploads* (not videos attached to a listing) — the only thing
 * bounding R2 storage abuse via uploads that never get attached to a listing at all. */
exports.MAX_VIDEO_UPLOADS_PER_DAY = 12;
function isActive(until) {
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
function resolveVideoEntitlement(user, listing) {
    const elevated = isActive(user.agentProUntil) || isActive(listing?.boostedUntil);
    return elevated
        ? { ...exports.VIDEO_LIMITS.elevated, canUpgradeByBoosting: false }
        : { ...exports.VIDEO_LIMITS.default, canUpgradeByBoosting: true };
}
