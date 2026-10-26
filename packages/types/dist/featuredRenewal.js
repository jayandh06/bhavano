"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURED_RENEW_WINDOW_DAYS = void 0;
exports.featuredEndsSoon = featuredEndsSoon;
/** How close to its end a Featured ad has to be before the owner is reminded and My listings offers "Renew Feature". One number
 * for the reminder job (3 days and 1 day before) and the button, so the two never disagree. See
 * docs/plans/featured-expiry-reminder.md. */
exports.FEATURED_RENEW_WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** True while the ad is Featured and its Feature period ends within the renewal window. */
function featuredEndsSoon(boostedUntil, now = Date.now()) {
    if (!boostedUntil)
        return false;
    const end = new Date(boostedUntil).getTime();
    return end > now && end - now <= exports.FEATURED_RENEW_WINDOW_DAYS * DAY_MS;
}
