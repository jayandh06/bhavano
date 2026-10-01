"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_SAMPLE_SIZE = void 0;
exports.boostRecoveryMessage = boostRecoveryMessage;
/** Below this, in either cohort, the comparison is too noisy to state as a number — a stat from a
 * handful of listings can flip sign next week. Matches the real account history checked when this
 * was designed: ~17-18 total boosts in a month, so the boosted cohort is the one expected to be
 * the limiting side for a while yet. */
exports.MIN_SAMPLE_SIZE = 10;
/** Pure so it's testable without a DB: given the cached stats (or none at all, before the first
 * nightly computation has ever run), decide what the dialog actually says. Prefers the contact
 * rate over raw views when there's a real lift to quote — "got a reply" is a more convincing,
 * more honest signal to a seller than a view count, which includes idle scrolling. */
function boostRecoveryMessage(stats) {
    const fallback = {
        hasEnoughData: false,
        headline: "Boosted ads get priority placement and reach more buyers.",
    };
    if (!stats)
        return fallback;
    if (stats.boostedSampleSize < exports.MIN_SAMPLE_SIZE || stats.unboostedSampleSize < exports.MIN_SAMPLE_SIZE)
        return fallback;
    if (stats.contactRate7dUnboosted > 0) {
        const lift = stats.contactRate7dBoosted / stats.contactRate7dUnboosted;
        if (lift > 1.05) {
            return {
                hasEnoughData: true,
                headline: `Boosted ads got contacted ${lift.toFixed(1)}x more often in their first week, on Bhavano's last month of listings.`,
            };
        }
    }
    if (stats.avgViews7dUnboosted > 0) {
        const lift = stats.avgViews7dBoosted / stats.avgViews7dUnboosted;
        if (lift > 1.05) {
            return {
                hasEnoughData: true,
                headline: `Boosted ads got ${lift.toFixed(1)}x more views in their first week, on Bhavano's last month of listings.`,
            };
        }
    }
    // Real data, but no measurable lift yet — the honest thing is the fallback, not a stat that
    // undersells (or wrongly oversells) itself.
    return fallback;
}
