"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_FREE_AD_CHANNELS = exports.PAID_OWNER_ALERT_CHANNELS = exports.OWNER_ALERT_CHANNEL_LABELS = exports.DEFAULT_OWNER_ALERT_ORDER = exports.OWNER_ALERT_CHANNELS = void 0;
exports.withPrimaryChannel = withPrimaryChannel;
exports.normalizeOwnerAlertOrder = normalizeOwnerAlertOrder;
exports.isPaidOwnerAlertChannel = isPaidOwnerAlertChannel;
exports.effectiveOwnerAlertChannel = effectiveOwnerAlertChannel;
exports.paidChannelOpen = paidChannelOpen;
exports.ownerAlertPricingNote = ownerAlertPricingNote;
/** How an advertiser wants to be told when a seeker contacts them — see docs/plans/owner-notification-channel-preferences.md. */
exports.OWNER_ALERT_CHANNELS = ["push", "whatsapp", "sms", "email"];
/** Order used until the owner says otherwise, and to fill in the channels they did not rank. The app is first because it is the fastest and free;
 * WhatsApp next because it is the only out-of-app channel that reaches the phone-only majority of owners. */
exports.DEFAULT_OWNER_ALERT_ORDER = exports.OWNER_ALERT_CHANNELS;
exports.OWNER_ALERT_CHANNEL_LABELS = {
    push: "Mobile App notification",
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
/** WhatsApp and SMS cost money per message, so they are part of Featured ads (Instant Alerts is included in every boost). Push and email are free for everyone. */
exports.PAID_OWNER_ALERT_CHANNELS = ["whatsapp", "sms"];
function isPaidOwnerAlertChannel(channel) {
    return exports.PAID_OWNER_ALERT_CHANNELS.includes(channel);
}
/** The channel an alert about one ad actually goes out on: the first of the owner's order that can reach them and that this ad is allowed to use
 * (a paid channel only while the ad is Featured). Null when none can, which the Preview step treats as "choose or add one before posting". */
function effectiveOwnerAlertChannel(order, available, featured, freeAds = exports.NO_FREE_AD_CHANNELS) {
    return order.find((c) => available[c] && paidChannelOpen(c, featured, freeAds)) ?? null;
}
exports.NO_FREE_AD_CHANNELS = { whatsapp: false, sms: false };
/** Whether this channel may be used for an ad: always for the free ones; for WhatsApp / SMS when the ad is Featured or the admin opened it to all ads. */
function paidChannelOpen(channel, featured, freeAds = exports.NO_FREE_AD_CHANNELS) {
    if (!isPaidOwnerAlertChannel(channel) || featured)
        return true;
    return channel === "whatsapp" ? freeAds.whatsapp : channel === "sms" ? freeAds.sms : false;
}
/** The one-line explanation of what costs what, which changes with what the admin has opened. */
function ownerAlertPricingNote(freeAds = exports.NO_FREE_AD_CHANNELS) {
    if (freeAds.whatsapp && freeAds.sms)
        return "Alerts by app, WhatsApp, SMS and email are on for all ads.";
    if (freeAds.whatsapp)
        return "Alerts by app, WhatsApp and email are on for all ads. SMS is included with Featured ads.";
    if (freeAds.sms)
        return "Alerts by app, SMS and email are on for all ads. WhatsApp is included with Featured ads.";
    return "App notifications and email are free. WhatsApp and SMS are included with Featured ads.";
}
