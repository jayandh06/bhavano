"use strict";
/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md and,
 * for how the counts became admin-editable, docs/plans/admin-manage-plans-pricing.md. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingSlotCapBody = listingSlotCapBody;
exports.listingSlotAllowance = listingSlotAllowance;
const subscriptionPricing_1 = require("./subscriptionPricing");
/** The cap notice, built in one place so the BFF's publish error and the web post page (which shows it before the form is filled in) agree.
 * Slots only free up when an ad is closed, never by age (docs/plans/explicit-close-not-auto-expire.md), so the text does not promise otherwise. */
function listingSlotCapBody(activeCount, allowance, settings) {
    // Below the seller slot pack's own ceiling that upgrade alone would still help; at or above it only Pro adds room.
    const packHelps = allowance < settings.sellerSlotPackTotalSlots;
    return {
        code: "LISTING_SLOT_CAP_REACHED",
        message: `You have ${activeCount} active ads and your plan allows ${allowance}. Close an ad you no longer need, or upgrade for more slots.`,
        activeCount,
        allowance,
        upsell: packHelps ? ["sellerSlotPack", "agentPro"] : ["agentPro"],
        offers: {
            ...(packHelps ? { sellerSlotPack: { totalSlots: settings.sellerSlotPackTotalSlots, monthlyPrice: settings.sellerSlotPackMonthlyPrice } } : {}),
            agentPro: { totalSlots: settings.proListingSlotsPerUnit, monthlyPrice: settings.agentProMonthlyPricePerUnit },
        },
    };
}
function isActive(until) {
    return !!until && new Date(until).getTime() > Date.now();
}
/** Max concurrent active listings this user may have. */
function listingSlotAllowance(user, settings = subscriptionPricing_1.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS) {
    let allowance = settings.freeListingSlots;
    if (isActive(user.sellerSlotPackUntil)) {
        allowance = Math.max(allowance, settings.sellerSlotPackTotalSlots);
    }
    if (isActive(user.agentProUntil)) {
        const units = Math.max(1, user.agentProUnits ?? 1);
        allowance = Math.max(allowance, units * settings.proListingSlotsPerUnit);
    }
    return allowance;
}
