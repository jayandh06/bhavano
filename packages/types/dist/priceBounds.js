"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_BOUNDS = void 0;
exports.listingPriceIssue = listingPriceIssue;
const areaUnit_1 = require("./areaUnit");
const priceQualifiers_1 = require("./priceQualifiers");
const priceWords_1 = require("./priceWords");
/** Rough plausibility bounds per category (INR) Ã¢ÂÂ originally just a fat-finger/scam-price
 * defense at posting time (see apps/bff/src/moderation/priceBounds.ts), also reused by the web
 * app to build category-aware price quick-picks on browse pages. Sale = buy/sell, rental =
 * rent/lease. Tune as real submissions come in. */
exports.PRICE_BOUNDS = {
    house: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    apartment: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    villa: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    pg: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 100_000 } },
    storage: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 200, max: 100_000 } },
    coworking: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 500, max: 200_000 } },
    furniture: { sale: { min: 50, max: 1_000_000 }, rental: { min: 50, max: 50_000 } },
    // Sell-only (see POSTABLE_TRANSACTION_TYPES) Ã¢ÂÂ the `rental` bound is never actually reached.
    interiors: { sale: { min: 500, max: 5_000_000 }, rental: { min: 500, max: 5_000_000 } },
    // Sell-only Ã¢ÂÂ land spans the same price range as built residential property. `rental` mirrors
    // `sale` (never reached), same pattern as `interiors` above.
    plot: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 100_000, max: 500_000_000 } },
    // A small shop and a large warehouse are both "commercial", hence the wide rental band. `sale`
    // shares the standard real-estate-sale band used by every other sellable category.
    commercial: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 5_000, max: 2_000_000 } },
};
/**
 * Why a listing's price can't be posted, or null. Always judged on the total stored in
 * `Listing.price`, never on a per-unit figure: ₹12,500 per sq ft is a normal house rate, and the
 * ₹1 lakh minimum is for the whole property. When the seller priced per unit, pass what they
 * typed so the message can show the working. Shared by the BFF (the authority) and both post
 * forms, which check before the preview so a seller never learns this after uploading photos.
 */
function listingPriceIssue(category, transactionType, total, perUnit) {
    if (total === 0 && priceQualifiers_1.PRICE_ON_REQUEST_CATEGORIES.has(category))
        return null;
    const bounds = exports.PRICE_BOUNDS[category][transactionType === "buy" || transactionType === "sell" ? "sale" : "rental"];
    if (total >= bounds.min && total <= bounds.max)
        return null;
    const range = `${(0, priceWords_1.formatInrWithWords)(bounds.min)} to ${(0, priceWords_1.formatInrWithWords)(bounds.max)}`;
    if (!perUnit)
        return `Price ${(0, priceWords_1.formatInrWithWords)(total)} is outside the expected range (${range}) for this category`;
    const unit = (0, areaUnit_1.areaUnitShortLabel)(perUnit.unit, 1);
    return (`₹${(0, priceWords_1.groupInr)(perUnit.price)}/${unit} × ${(0, priceWords_1.groupInr)(perUnit.area)} ${(0, areaUnit_1.areaUnitShortLabel)(perUnit.unit, perUnit.area)} ` +
        `comes to ${(0, priceWords_1.formatInrWithWords)(total)}, outside the expected range (${range}) for this category. ` +
        `Check the price per ${unit} and the area.`);
}
