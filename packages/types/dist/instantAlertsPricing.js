"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS = void 0;
/** Bundled into this shared package (not just the BFF) for the same reason
 * DEFAULT_BOOST_PRICE_SETTINGS is — used client-side for display before any live-settings fetch
 * resolves, and as the BFF's own DB-row fallback when no settings have ever been saved. */
exports.DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS = {
    instantAlertsPrice: 25,
};
