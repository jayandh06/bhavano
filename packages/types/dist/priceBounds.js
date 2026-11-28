"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.US_PRICE_BOUNDS = exports.PRICE_BOUNDS = void 0;
exports.priceBoundsFor = priceBoundsFor;
exports.listingPriceIssue = listingPriceIssue;
exports.requirementBudgetIssue = requirementBudgetIssue;
const areaUnit_1 = require("./areaUnit");
const priceQualifiers_1 = require("./priceQualifiers");
const priceWords_1 = require("./priceWords");
const market_1 = require("./market");
/** Rough plausibility bounds per category (INR) Ã¢ÂÂ originally just a fat-finger/scam-price
 * defense at posting time (see apps/bff/src/moderation/priceBounds.ts), also reused by the web
 * app to build category-aware price quick-picks on browse pages. Sale = buy/sell, rental =
 * rent/lease. Tune as real submissions come in. */
exports.PRICE_BOUNDS = {
    house: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    apartment: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    villa: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    // US-only categories, judged by US_PRICE_BOUNDS below; these rows only complete the record.
    condo: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    townhouse: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
    room: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 100, max: 100_000 } },
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
/** US plausibility bounds in dollars: a tenth of the national average to fifty times it, rounded. Averages (late 2026)
 * and their sources are in docs/plans/us-price-limits.md: home sale $416,700, home rent about $2,000 a month, room rent
 * about $1,000, a 10x10 storage unit about $119, commercial sale (median) $575,000. No national figure exists for
 * commercial rent or for a storage unit's sale price, so those two are simply wide. */
const US_HOME = { sale: { min: 40_000, max: 20_000_000 }, rental: { min: 200, max: 100_000 } };
/** Only the categories the US offers; any other keeps the shared bounds above. */
exports.US_PRICE_BOUNDS = {
    house: US_HOME,
    apartment: US_HOME,
    condo: US_HOME,
    townhouse: US_HOME,
    // Rent-only, so the sale band is never reached.
    room: { sale: US_HOME.sale, rental: { min: 100, max: 50_000 } },
    storage: { sale: { min: 1_000, max: 10_000_000 }, rental: { min: 10, max: 6_000 } },
    // The sale ceiling is the most the price box accepts: whole buildings sell for far more than any average suggests.
    commercial: { sale: { min: 50_000, max: 200_000_000 }, rental: { min: 100, max: 1_000_000 } },
};
/** The bounds a price or budget is judged against in a market. */
function priceBoundsFor(category, transactionType, marketId = "in") {
    const byCategory = (marketId === "us" ? exports.US_PRICE_BOUNDS[category] : undefined) ?? exports.PRICE_BOUNDS[category];
    return byCategory[transactionType === "buy" || transactionType === "sell" ? "sale" : "rental"];
}
/**
 * Why a listing's price can't be posted, or null. Always judged on the total stored in
 * `Listing.price`, never on a per-unit figure: ₹12,500 per sq ft is a normal house rate, and the
 * ₹1 lakh minimum is for the whole property. When the seller priced per unit, pass what they
 * typed so the message can show the working. Shared by the BFF (the authority) and both post
 * forms, which check before the preview so a seller never learns this after uploading photos.
 * Bounds and wording follow `marketId` (India when not given).
 */
function listingPriceIssue(category, transactionType, total, perUnit, marketId = "in") {
    if (total === 0 && priceQualifiers_1.PRICE_ON_REQUEST_CATEGORIES.has(category))
        return null;
    const bounds = priceBoundsFor(category, transactionType, marketId);
    if (total >= bounds.min && total <= bounds.max)
        return null;
    const words = (amount) => (marketId === "in" ? (0, priceWords_1.formatInrWithWords)(amount) : (0, market_1.formatMoney)(marketId, amount));
    const range = `${words(bounds.min)} to ${words(bounds.max)}`;
    if (!perUnit)
        return `Price ${words(total)} is outside the expected range (${range}) for this category`;
    const unit = (0, areaUnit_1.areaUnitShortLabel)(perUnit.unit, 1);
    return (`${(0, market_1.formatMoney)(marketId, perUnit.price)}/${unit} × ${(0, market_1.groupAmount)(marketId, perUnit.area)} ${(0, areaUnit_1.areaUnitShortLabel)(perUnit.unit, perUnit.area)} ` +
        `comes to ${words(total)}, outside the expected range (${range}) for this category. ` +
        `Check the price per ${unit} and the area.`);
}
/**
 * Why a requirement's budget figure can't be used, or null — the same category/transaction-aware
 * bounds `listingPriceIssue` enforces on a listing's own price, applied to each end of the
 * seeker's range independently. Price range is mandatory on a requirement (see
 * docs/plans/requirement-refinement-questions.md's 2026-10-08 update): an owner or agent
 * reviewing a lead needs a believable figure to judge whether their own listing is even in the
 * right range, so a budget outside the category's plausible range is as unusable to them as no
 * budget at all — this used to be a floor-only check for exactly that reason (a ceiling didn't
 * matter when budget was optional either way), until budget became required.
 */
function requirementBudgetIssue(category, transactionType, value, marketId = "in") {
    const bounds = priceBoundsFor(category, transactionType, marketId);
    if (value >= bounds.min && value <= bounds.max)
        return null;
    if (marketId !== "in") {
        const money = (amount) => (0, market_1.formatMoney)(marketId, amount);
        return `${money(value)} is outside the typical range for this category (${money(bounds.min)} to ${money(bounds.max)})`;
    }
    const range = `${(0, priceWords_1.formatInrWithWords)(bounds.min)} to ${(0, priceWords_1.formatInrWithWords)(bounds.max)}`;
    return `₹${(0, priceWords_1.groupInr)(value)} is outside the typical range for this category (${range})`;
}
