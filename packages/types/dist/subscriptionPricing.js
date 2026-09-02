"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELLER_SLOT_PACK_MONTHLY_PRICE = exports.AGENT_PRO_MONTHLY_PRICE = exports.BUYER_PREMIUM_PRICE = void 0;
exports.subscriptionPriceFor = subscriptionPriceFor;
exports.BUYER_PREMIUM_PRICE = {
    1: 99,
    6: 549,
    12: 899,
};
/** Seller-side "Agent/Broker Pro" — 20 concurrent slots per unit + storefront. Monthly only. */
exports.AGENT_PRO_MONTHLY_PRICE = 499;
/** Individual seller add-on — 10 concurrent slots total (5 free + 5). Monthly only. */
exports.SELLER_SLOT_PACK_MONTHLY_PRICE = 149;
function subscriptionPriceFor(tier, months, agentProUnits = 1) {
    if (tier === "buyerPremium") {
        if (months !== 1 && months !== 6 && months !== 12) {
            throw new Error(`Unsupported buyerPremium duration: ${months}`);
        }
        return exports.BUYER_PREMIUM_PRICE[months];
    }
    if (tier === "sellerSlotPack") {
        if (months !== 1)
            throw new Error(`Unsupported sellerSlotPack duration: ${months}`);
        return exports.SELLER_SLOT_PACK_MONTHLY_PRICE * months;
    }
    if (months !== 1)
        throw new Error(`Unsupported agentPro duration: ${months}`);
    const units = Math.max(1, Math.min(agentProUnits, 20));
    return exports.AGENT_PRO_MONTHLY_PRICE * units;
}
