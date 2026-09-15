"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOOST_PRICE_SETTINGS = void 0;
exports.boostPriceFor = boostPriceFor;
/** Bundled into this shared package (not just the BFF) since `boostPriceFor` below is also
 * called client-side, purely for display, before any live-settings fetch resolves — see
 * BoostProvider.tsx (web) / BoostModal.tsx (mobile). The BFF's own DB-row fallback (when no
 * settings have ever been saved) reuses this exact same constant rather than redefining it. */
exports.DEFAULT_BOOST_PRICE_SETTINGS = {
    propertyBoostPrice7d: 199,
    propertyBoostPrice15d: 349,
    coworkingPgStorageBoostPrice7d: 99,
    coworkingPgStorageBoostPrice15d: 179,
    furnitureInteriorsBoostPrice7d: 49,
    furnitureInteriorsBoostPrice15d: 89,
};
const PROPERTY_CATEGORIES = new Set(["house", "apartment", "villa", "plot", "commercial"]);
const MID_VALUE_CATEGORIES = new Set(["coworking", "pg", "storage"]);
// furniture/interiors fall through to the remaining low-value tier below.
function boostPriceFor(category, days, settings = exports.DEFAULT_BOOST_PRICE_SETTINGS) {
    const [price7d, price15d] = PROPERTY_CATEGORIES.has(category)
        ? [settings.propertyBoostPrice7d, settings.propertyBoostPrice15d]
        : MID_VALUE_CATEGORIES.has(category)
            ? [settings.coworkingPgStorageBoostPrice7d, settings.coworkingPgStorageBoostPrice15d]
            : [settings.furnitureInteriorsBoostPrice7d, settings.furnitureInteriorsBoostPrice15d];
    return days === 7 ? price7d : price15d;
}
