"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFeaturedPerformance = buildFeaturedPerformance;
exports.perDay = perDay;
const DAY_MS = 86_400_000;
/** Pure so it can be tested without a DB: turns the raw counts into the DTO. */
function buildFeaturedPerformance(input) {
    const { boostedFrom, boostedUntil, listingCreatedAt, now, during, beforeCounts } = input;
    const active = boostedUntil.getTime() > now.getTime();
    const end = active ? now : boostedUntil;
    const daysFeatured = Math.max(0, (end.getTime() - boostedFrom.getTime()) / DAY_MS);
    const daysBefore = (boostedFrom.getTime() - listingCreatedAt.getTime()) / DAY_MS;
    return {
        since: boostedFrom.toISOString(),
        until: boostedUntil.toISOString(),
        active,
        daysFeatured: Math.round(daysFeatured * 10) / 10,
        ...during,
        before: daysBefore >= 1 ? { days: Math.round(daysBefore * 10) / 10, ...beforeCounts } : null,
    };
}
/** Per-day rate, one decimal, for the "before vs Featured" line. 0 when there is no time span. */
function perDay(count, days) {
    return days > 0 ? Math.round((count / days) * 10) / 10 : 0;
}
