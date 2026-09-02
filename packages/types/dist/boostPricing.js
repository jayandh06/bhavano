"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOST_PRICE_TIERS = void 0;
exports.boostPriceFor = boostPriceFor;
/** Category-tiered boost pricing — a flat fee across categories this different in value (a ₹50
 * furniture listing vs. a multi-crore apartment) would be either exploitative for cheap
 * categories or too cheap to matter for expensive ones. See
 * docs/plans/monetization-boosted-listings-premium-tiers.md. Tune as real usage comes in. */
exports.BOOST_PRICE_TIERS = {
    // High-value: house, apartment, villa, plot, commercial
    house: { prices: { 7: 199, 15: 349 } },
    apartment: { prices: { 7: 199, 15: 349 } },
    villa: { prices: { 7: 199, 15: 349 } },
    plot: { prices: { 7: 199, 15: 349 } },
    commercial: { prices: { 7: 199, 15: 349 } },
    // Mid-value: coworking, pg, storage
    coworking: { prices: { 7: 99, 15: 179 } },
    pg: { prices: { 7: 99, 15: 179 } },
    storage: { prices: { 7: 99, 15: 179 } },
    // Low-value: furniture, interiors
    furniture: { prices: { 7: 49, 15: 89 } },
    interiors: { prices: { 7: 49, 15: 89 } },
};
function boostPriceFor(category, days) {
    return exports.BOOST_PRICE_TIERS[category].prices[days];
}
