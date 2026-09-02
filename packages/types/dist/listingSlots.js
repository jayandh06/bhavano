"use strict";
/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRO_LISTING_SLOTS_PER_UNIT = exports.SELLER_SLOT_PACK_TOTAL = exports.FREE_LISTING_SLOTS = void 0;
exports.listingSlotAllowance = listingSlotAllowance;
exports.FREE_LISTING_SLOTS = 5;
exports.SELLER_SLOT_PACK_TOTAL = 10;
exports.PRO_LISTING_SLOTS_PER_UNIT = 20;
function isActive(until) {
    return !!until && new Date(until).getTime() > Date.now();
}
/** Max concurrent active listings this user may have. */
function listingSlotAllowance(user) {
    let allowance = exports.FREE_LISTING_SLOTS;
    if (isActive(user.sellerSlotPackUntil)) {
        allowance = Math.max(allowance, exports.SELLER_SLOT_PACK_TOTAL);
    }
    if (isActive(user.agentProUntil)) {
        const units = Math.max(1, user.agentProUnits ?? 1);
        allowance = Math.max(allowance, units * exports.PRO_LISTING_SLOTS_PER_UNIT);
    }
    return allowance;
}
