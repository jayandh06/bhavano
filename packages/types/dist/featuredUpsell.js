"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FEATURED_UPSELL_SETTINGS = void 0;
exports.isUpsellEligibleListing = isUpsellEligibleListing;
exports.pickFeaturedUpsell = pickFeaturedUpsell;
exports.DEFAULT_FEATURED_UPSELL_SETTINGS = {
    enabled: false,
    listingCardEnabled: false,
    minAgeHours: 1,
    quietDays: 3,
    maxShowsPerAd: 3,
};
function isUpsellEligibleListing(l, minAgeHours, nowMs) {
    if (l.status !== "active" || l.isBoosted)
        return false;
    if (l.publishState && l.publishState !== "live")
        return false;
    return nowMs - new Date(l.createdAt).getTime() >= minAgeHours * 3_600_000;
}
/** Decides whether to offer Featured on this visit, and for which ad. Once per browser session (`shownThisSession`), never for an ad offered `maxShowsPerAd` times or dismissed
 * within `quietDays`; the newest eligible ad is the one offered. Returns null when nothing should show. */
function pickFeaturedUpsell(input) {
    if (input.shownThisSession)
        return null;
    const { minAgeHours, quietDays, maxShowsPerAd } = input.settings;
    const candidates = input.listings
        .filter((l) => isUpsellEligibleListing(l, minAgeHours, input.nowMs))
        .filter((l) => {
        const m = input.memory(l.id);
        if (m.shows >= maxShowsPerAd)
            return false;
        return m.dismissedAtMs == null || input.nowMs - m.dismissedAtMs >= quietDays * 86_400_000;
    })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return candidates[0] ?? null;
}
