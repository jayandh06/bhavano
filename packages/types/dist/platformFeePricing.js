"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PLATFORM_FEE_SETTINGS = void 0;
exports.platformFeeFor = platformFeeFor;
exports.platformFeeApplies = platformFeeApplies;
exports.DEFAULT_PLATFORM_FEE_SETTINGS = {
    propertyListingFee: 0,
    coworkingPgStorageListingFee: 0,
    furnitureInteriorsListingFee: 0,
    allowLivePublishWithPendingPayment: false,
};
const PROPERTY_CATEGORIES = new Set(["house", "apartment", "villa", "plot", "commercial"]);
const MID_VALUE_CATEGORIES = new Set(["coworking", "pg", "storage"]);
function platformFeeFor(category, settings = exports.DEFAULT_PLATFORM_FEE_SETTINGS) {
    if (PROPERTY_CATEGORIES.has(category))
        return settings.propertyListingFee;
    if (MID_VALUE_CATEGORIES.has(category))
        return settings.coworkingPgStorageListingFee;
    return settings.furnitureInteriorsListingFee;
}
function platformFeeApplies(category, settings = exports.DEFAULT_PLATFORM_FEE_SETTINGS) {
    return platformFeeFor(category, settings) > 0;
}
