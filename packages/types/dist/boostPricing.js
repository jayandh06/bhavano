"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOOST_PRICE_SETTINGS = void 0;
exports.boostPriceFor = boostPriceFor;
exports.buildDisplayBoostPricing = buildDisplayBoostPricing;
const promoCode_1 = require("./promoCode");
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
    showSelectorOnPreview: false,
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
/** Display pricing built from the public, no-login-required settings + active-promo endpoint
 * (`GET /plans/pricing`, `activeDiscountPercent`) — for the ad-preview step's `BoostPlanSelector`,
 * which has to be usable before the advertiser has necessarily logged in (posting an ad only asks
 * for an account at the final "Post ad" tap). `PaymentsService.previewBoostPricing` is the
 * authenticated, personalized equivalent (also resolves per-user redemption caps and the Agent
 * Pro free-credit case) used everywhere else a price is shown post-login — this is deliberately
 * never used to decide what a checkout actually charges, only what the selector displays before
 * that fetch is even possible. `discountPercent` omitted/`null` shows undiscounted prices, same
 * as `previewBoostPricing` would once the code turns out invalid/expired/exhausted. */
function buildDisplayBoostPricing(category, boostSettings, instantAlertsSettings, discountPercent) {
    const boost7 = boostPriceFor(category, 7, boostSettings);
    const boost15 = boostPriceFor(category, 15, boostSettings);
    const alerts = instantAlertsSettings.instantAlertsPrice;
    const option = (amount) => discountPercent
        ? { amount: (0, promoCode_1.promoPriceFor)(amount, discountPercent), originalAmount: amount, discountApplied: true, free: false }
        : { amount, originalAmount: amount, discountApplied: false, free: false };
    return {
        boost7: option(boost7),
        boost15: option(boost15),
        boost7WithInstantAlerts: option(boost7 + alerts),
        boost15WithInstantAlerts: option(boost15 + alerts),
        showSelectorOnPreview: boostSettings.showSelectorOnPreview,
    };
}
