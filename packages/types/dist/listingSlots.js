"use strict";
/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md and,
 * for how the counts became admin-editable, docs/plans/admin-manage-plans-pricing.md. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingSlotAllowance = listingSlotAllowance;
const subscriptionPricing_1 = require("./subscriptionPricing");
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
