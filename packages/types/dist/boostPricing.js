"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOOST_PRICE_SETTINGS = exports.BOOST_DURATIONS = void 0;
exports.enabledBoostDurations = enabledBoostDurations;
exports.offeredBoostDurations = offeredBoostDurations;
exports.defaultBoostDuration = defaultBoostDuration;
exports.boostPriceFor = boostPriceFor;
exports.boostOptionFor = boostOptionFor;
exports.boostSavings = boostSavings;
exports.buildDisplayBoostPricing = buildDisplayBoostPricing;
const promoCode_1 = require("./promoCode");
/** Every duration a seller can buy, shortest first — the one list the pickers render from. */
exports.BOOST_DURATIONS = [7, 15, 30];
/** Bundled into this shared package (not just the BFF) since `boostPriceFor` below is also
 * called client-side, purely for display, before any live-settings fetch resolves — see
 * BoostProvider.tsx (web) / BoostModal.tsx (mobile). The BFF's own DB-row fallback (when no
 * settings have ever been saved) reuses this exact same constant rather than redefining it. */
exports.DEFAULT_BOOST_PRICE_SETTINGS = {
    propertyBoostPrice7d: 199,
    propertyBoostPrice15d: 349,
    propertyBoostPrice30d: 599,
    coworkingPgStorageBoostPrice7d: 99,
    coworkingPgStorageBoostPrice15d: 179,
    coworkingPgStorageBoostPrice30d: 299,
    furnitureInteriorsBoostPrice7d: 49,
    furnitureInteriorsBoostPrice15d: 89,
    furnitureInteriorsBoostPrice30d: 149,
    showSelectorOnPreview: false,
    boost7dEnabled: true,
    boost15dEnabled: true,
    boost30dEnabled: true,
    allowSkippingBoost: true,
};
/** The durations admin has switched on, shortest first. A flag missing from a response sent by a
 * server older than these toggles counts as on. */
function enabledBoostDurations(settings) {
    return exports.BOOST_DURATIONS.filter((days) => (days === 7 ? settings.boost7dEnabled : days === 15 ? settings.boost15dEnabled : settings.boost30dEnabled) !==
        false);
}
/** What a picker shows. A response from before `enabledDurations` existed offers all three. */
function offeredBoostDurations(pricing) {
    const enabled = pricing?.enabledDurations;
    return enabled && enabled.length > 0 ? enabled : exports.BOOST_DURATIONS;
}
/** The pre-selected duration: 15 days (cheaper per day than 7, see
 * docs/plans/boost-30-day-and-included-alerts.md) when offered, else the first one offered. */
function defaultBoostDuration(offered) {
    return offered.includes(15) ? 15 : (offered[0] ?? 15);
}
const PROPERTY_CATEGORIES = new Set(["house", "apartment", "villa", "plot", "commercial"]);
const MID_VALUE_CATEGORIES = new Set(["coworking", "pg", "storage"]);
// furniture/interiors fall through to the remaining low-value tier below.
function boostPriceFor(category, days, settings = exports.DEFAULT_BOOST_PRICE_SETTINGS) {
    const [price7d, price15d, price30d] = PROPERTY_CATEGORIES.has(category)
        ? [settings.propertyBoostPrice7d, settings.propertyBoostPrice15d, settings.propertyBoostPrice30d]
        : MID_VALUE_CATEGORIES.has(category)
            ? [
                settings.coworkingPgStorageBoostPrice7d,
                settings.coworkingPgStorageBoostPrice15d,
                settings.coworkingPgStorageBoostPrice30d,
            ]
            : [
                settings.furnitureInteriorsBoostPrice7d,
                settings.furnitureInteriorsBoostPrice15d,
                settings.furnitureInteriorsBoostPrice30d,
            ];
    return days === 7 ? price7d : days === 15 ? price15d : price30d;
}
/** The option for one duration — so a picker can index by the duration it is showing instead of
 * spelling out `boost7` / `boost15` / `boost30` at every use. */
function boostOptionFor(pricing, days) {
    return days === 7 ? pricing.boost7 : days === 15 ? pricing.boost15 : pricing.boost30;
}
/** What a longer boost saves against the 7-day price, for the badge under each option. Computed
 * from the *charged* amounts (any promo already applied), so the figure on screen matches the
 * price next to it: the promo takes the same percentage off every duration, so the saving is the
 * same shape with or without it.
 *
 * "Save ₹125" means: 30 days bought at the 7-day rate would cost ₹424; this costs ₹299.
 * Null when there is nothing honest to say — a free option (Agent Pro credit), a missing price, or
 * a longer option that is not actually cheaper per day. */
function boostSavings(pricing, days) {
    const short = pricing.boost7;
    const long = days === 15 ? pricing.boost15 : pricing.boost30;
    if (!short || !long || short.free || long.free || short.amount <= 0 || long.amount <= 0)
        return null;
    const atShortRate = Math.round((short.amount / 7) * days);
    const rupees = atShortRate - long.amount;
    if (rupees <= 0)
        return null;
    return {
        perDay: Math.round(long.amount / days),
        rupees,
        percent: Math.round((rupees / atShortRate) * 100),
    };
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
function buildDisplayBoostPricing(category, boostSettings, discountPercent) {
    const boost7 = boostPriceFor(category, 7, boostSettings);
    const boost15 = boostPriceFor(category, 15, boostSettings);
    const boost30 = boostPriceFor(category, 30, boostSettings);
    const option = (amount) => discountPercent
        ? { amount: (0, promoCode_1.promoPriceFor)(amount, discountPercent), originalAmount: amount, discountApplied: true, free: false }
        : { amount, originalAmount: amount, discountApplied: false, free: false };
    return {
        boost7: option(boost7),
        boost15: option(boost15),
        boost30: option(boost30),
        // Instant Alerts is included in every boost now, at no extra charge — these two exist only so
        // an older app build that still reads them shows the same price as the plain option.
        boost7WithInstantAlerts: option(boost7),
        boost15WithInstantAlerts: option(boost15),
        showSelectorOnPreview: boostSettings.showSelectorOnPreview,
        enabledDurations: enabledBoostDurations(boostSettings),
        allowSkippingBoost: boostSettings.allowSkippingBoost,
    };
}
