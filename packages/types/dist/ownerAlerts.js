"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNER_ALERT_CHANNEL_LABELS = exports.DEFAULT_OWNER_ALERT_ORDER = exports.OWNER_ALERT_CHANNELS = void 0;
exports.withPrimaryChannel = withPrimaryChannel;
exports.normalizeOwnerAlertOrder = normalizeOwnerAlertOrder;
/** How an advertiser wants to be told when a seeker contacts them — see docs/plans/owner-notification-channel-preferences.md. */
exports.OWNER_ALERT_CHANNELS = ["push", "whatsapp", "sms", "email"];
/** Order used until the owner says otherwise, and to fill in the channels they did not rank. The app is first because it is the fastest and free;
 * WhatsApp next because it is the only out-of-app channel that reaches the phone-only majority of owners. */
exports.DEFAULT_OWNER_ALERT_ORDER = exports.OWNER_ALERT_CHANNELS;
exports.OWNER_ALERT_CHANNEL_LABELS = {
    push: "App notification",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
};
/** Puts `primary` first and keeps everyone else in the order they already had, so choosing a primary never scrambles the fallbacks. */
function withPrimaryChannel(current, primary) {
    return [primary, ...normalizeOwnerAlertOrder(current).filter((c) => c !== primary)];
}
/** Drops unknown and repeated entries, then appends the channels that were left out, so a stored order is always complete. */
function normalizeOwnerAlertOrder(input) {
    const seen = new Set();
    for (const c of input ?? []) {
        if (exports.OWNER_ALERT_CHANNELS.includes(c))
            seen.add(c);
    }
    for (const c of exports.DEFAULT_OWNER_ALERT_ORDER)
        seen.add(c);
    return [...seen];
}
