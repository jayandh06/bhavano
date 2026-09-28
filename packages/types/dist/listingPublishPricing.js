"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingPublishCheckoutTotalRupees = listingPublishCheckoutTotalRupees;
exports.listingPublishRequiresCheckout = listingPublishRequiresCheckout;
const platformFeePricing_1 = require("./platformFeePricing");
const boostPricing_1 = require("./boostPricing");
/** Rupee total for the publish checkout cart (display only — PaymentsService is authoritative).
 * Platform fee is never promo-discounted; `boostPricing` amounts may already include the active
 * boost/IA discount for display. */
function listingPublishCheckoutTotalRupees(category, platformFeeSettings, boostPricing, boostSelection) {
    let total = (0, platformFeePricing_1.platformFeeFor)(category, platformFeeSettings);
    if (!boostSelection || !boostPricing)
        return total;
    // Instant Alerts is included in every boost at no extra charge, so the price depends on the
    // duration alone.
    total += (0, boostPricing_1.boostOptionFor)(boostPricing, boostSelection.duration).amount;
    return total;
}
function listingPublishRequiresCheckout(category, platformFeeSettings, boostSelection) {
    if (platformFeeSettings.allowLivePublishWithPendingPayment)
        return false;
    return (0, platformFeePricing_1.platformFeeFor)(category, platformFeeSettings) > 0 || boostSelection !== null;
}
