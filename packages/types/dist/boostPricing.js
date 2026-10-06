"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOOST_PRICE_SETTINGS = exports.DEFAULT_VALUE_BAND_RULES = exports.BOOST_DURATIONS = void 0;
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
const PROPERTY_RULE_CATEGORIES = ["house", "apartment", "villa", "plot", "commercial"];
/** Starting placeholder bands — explicitly not real percentile data (none was reachable from the
 * dev environment this was written in; the production DB is only reachable from inside Bhavano's
 * own infrastructure). Each rule's middle band matches today's existing flat tier price, so a
 * typical listing's price doesn't move on rollout — only genuinely cheap or genuinely expensive
 * listings do. See docs/plans/boost-proof-stat-and-value-bands.md for the full reasoning and the
 * table these come from. Replace with real cutoffs/prices via the admin settings once production
 * listing-price/rent percentiles can be pulled. */
exports.DEFAULT_VALUE_BAND_RULES = [
    {
        categories: PROPERTY_RULE_CATEGORIES,
        transactionTypes: ["sell", "buy"],
        bands: [
            { maxValue: 50_00_000, price7d: 149, price15d: 249, price30d: 449 },
            { maxValue: 2_00_00_000, price7d: 199, price15d: 349, price30d: 599 },
            { maxValue: null, price7d: 349, price15d: 599, price30d: 999 },
        ],
    },
    {
        categories: PROPERTY_RULE_CATEGORIES,
        transactionTypes: ["rent", "lease"],
        bands: [
            { maxValue: 15_000, price7d: 99, price15d: 179, price30d: 299 },
            { maxValue: 50_000, price7d: 199, price15d: 349, price30d: 599 },
            { maxValue: null, price7d: 299, price15d: 499, price30d: 849 },
        ],
    },
    {
        categories: ["furniture", "interiors"],
        transactionTypes: ["sell", "buy"],
        bands: [
            { maxValue: 5_000, price7d: 29, price15d: 49, price30d: 79 },
            { maxValue: 20_000, price7d: 49, price15d: 89, price30d: 149 },
            { maxValue: null, price7d: 79, price15d: 139, price30d: 229 },
        ],
    },
    {
        // Furniture/interiors rented rather than sold outright — real usage (see
        // ads_retarget_owners.py's "Rent out Furniture" ad group) — priced far below the sell table
        // since this is a monthly rate, not a one-time price.
        categories: ["furniture", "interiors"],
        transactionTypes: ["rent", "lease"],
        bands: [
            { maxValue: 500, price7d: 19, price15d: 29, price30d: 49 },
            { maxValue: 2_000, price7d: 29, price15d: 49, price30d: 79 },
            { maxValue: null, price7d: 49, price15d: 79, price30d: 129 },
        ],
    },
    {
        // Inherently monthly — no sell variant.
        categories: ["pg"],
        transactionTypes: ["rent", "lease"],
        bands: [
            { maxValue: 6_000, price7d: 49, price15d: 89, price30d: 149 },
            { maxValue: 15_000, price7d: 99, price15d: 179, price30d: 299 },
            { maxValue: null, price7d: 149, price15d: 259, price30d: 429 },
        ],
    },
    {
        // By monthly seat/desk price — inherently monthly, no sell variant.
        categories: ["coworking"],
        transactionTypes: ["rent", "lease"],
        bands: [
            { maxValue: 3_000, price7d: 49, price15d: 89, price30d: 149 },
            { maxValue: 10_000, price7d: 99, price15d: 179, price30d: 299 },
            { maxValue: null, price7d: 149, price15d: 259, price30d: 429 },
        ],
    },
    // Storage deliberately has no rule here — not asked for, stays on the flat
    // coworkingPgStorageBoostPrice* tier above, unchanged.
];
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
    valueBandRules: exports.DEFAULT_VALUE_BAND_RULES,
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
function boostPriceFor(category, days, settings = exports.DEFAULT_BOOST_PRICE_SETTINGS, context) {
    if (context) {
        const rule = settings.valueBandRules?.find((r) => r.categories.includes(category) && r.transactionTypes.includes(context.transactionType));
        const band = rule?.bands.find((b) => b.maxValue === null || context.value <= b.maxValue) ?? rule?.bands[rule.bands.length - 1];
        if (band)
            return days === 7 ? band.price7d : days === 15 ? band.price15d : band.price30d;
    }
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
function buildDisplayBoostPricing(category, boostSettings, discountPercent, 
/** The in-progress wizard's own transactionType + price/rent field, when the advertiser has
 * already entered it by the time this renders (the ad-preview step collects price before
 * review) — lets the preview-step selector show the real band price too, not just the flat
 * tier price. Omit while the value isn't known yet; falls back to the flat tier price. */
context) {
    const boost7 = boostPriceFor(category, 7, boostSettings, context);
    const boost15 = boostPriceFor(category, 15, boostSettings, context);
    const boost30 = boostPriceFor(category, 30, boostSettings, context);
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
