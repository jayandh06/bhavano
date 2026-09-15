"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS = void 0;
exports.subscriptionPriceFor = subscriptionPriceFor;
/** Bundled into this shared package (not just the BFF) since `subscriptionPriceFor`/
 * `listingSlotAllowance` are also called client-side for display, before any live-settings fetch
 * resolves. The BFF's own DB-row fallback reuses this exact same constant rather than
 * redefining it. */
exports.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS = {
    freeListingSlots: 5,
    sellerSlotPackTotalSlots: 10,
    sellerSlotPackMonthlyPrice: 149,
    proListingSlotsPerUnit: 20,
    agentProMonthlyPricePerUnit: 499,
    buyerPremiumPrice1Month: 99,
    buyerPremiumPrice6Months: 549,
    buyerPremiumPrice12Months: 899,
};
function subscriptionPriceFor(tier, months, agentProUnits = 1, settings = exports.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS) {
    if (tier === "buyerPremium") {
        if (months === 1)
            return settings.buyerPremiumPrice1Month;
        if (months === 6)
            return settings.buyerPremiumPrice6Months;
        if (months === 12)
            return settings.buyerPremiumPrice12Months;
        throw new Error(`Unsupported buyerPremium duration: ${months}`);
    }
    if (tier === "sellerSlotPack") {
        if (months !== 1)
            throw new Error(`Unsupported sellerSlotPack duration: ${months}`);
        return settings.sellerSlotPackMonthlyPrice * months;
    }
    if (months !== 1)
        throw new Error(`Unsupported agentPro duration: ${months}`);
    const units = Math.max(1, Math.min(agentProUnits, 20));
    return settings.agentProMonthlyPricePerUnit * units;
}
