"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.US_INSTANT_ALERTS_PRICE_SETTINGS = exports.DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS = void 0;
exports.defaultInstantAlertsPriceSettings = defaultInstantAlertsPriceSettings;
/** Bundled into this shared package (not just the BFF) for the same reason
 * DEFAULT_BOOST_PRICE_SETTINGS is — used client-side for display before any live-settings fetch
 * resolves, and as the BFF's own DB-row fallback when no settings have ever been saved. */
exports.DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS = {
    instantAlertsPrice: 25,
};
/** The US price: `usdTierFromInr` applied to India's. */
exports.US_INSTANT_ALERTS_PRICE_SETTINGS = {
    instantAlertsPrice: 5,
};
/** The default Instant Alerts price for a market (India unless another is named). */
function defaultInstantAlertsPriceSettings(marketId = "in") {
    return marketId === "us" ? exports.US_INSTANT_ALERTS_PRICE_SETTINGS : exports.DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS;
}
