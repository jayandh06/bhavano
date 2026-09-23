"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingPublishCheckoutTotalRupees = listingPublishCheckoutTotalRupees;
exports.listingPublishRequiresCheckout = listingPublishRequiresCheckout;
const platformFeePricing_1 = require("./platformFeePricing");
/** Rupee total for the publish checkout cart (display only — PaymentsService is authoritative). */
function listingPublishCheckoutTotalRupees(category, platformFeeSettings, boostPricing, boostSelection) {
    let total = (0, platformFeePricing_1.platformFeeFor)(category, platformFeeSettings);
    if (!boostSelection || !boostPricing)
        return total;
    const key = boostSelection.duration === 7
        ? boostSelection.includeInstantAlerts
            ? "boost7WithInstantAlerts"
            : "boost7"
        : boostSelection.includeInstantAlerts
            ? "boost15WithInstantAlerts"
            : "boost15";
    total += boostPricing[key].amount;
    return total;
}
function listingPublishRequiresCheckout(category, platformFeeSettings, boostSelection) {
    return (0, platformFeePricing_1.platformFeeFor)(category, platformFeeSettings) > 0 || boostSelection !== null;
}
