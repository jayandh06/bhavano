"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_APPLE_PRODUCT_IDS = exports.APPLE_CREDITS_PRODUCT_ID = exports.APPLE_BOOST_DAYS = exports.APPLE_SUBSCRIPTIONS = exports.APPLE_PRODUCT_PREFIX = void 0;
exports.appleSubscriptionsFor = appleSubscriptionsFor;
exports.appleBoostTierFor = appleBoostTierFor;
exports.appleBoostProductId = appleBoostProductId;
exports.isAppleConsumableProductId = isAppleConsumableProductId;
exports.isAppleProductId = isAppleProductId;
/** The product ids for In-App Purchase on the iOS app — the contract between the app, the server
 * and App Store Connect, in ONE place so they cannot drift apart. Create products in App Store
 * Connect with EXACTLY these ids. See docs/plans/ios-in-app-purchase.md.
 *
 * iOS sells a fixed catalogue at Apple price points. Unlike the web and Android checkout, whose
 * prices are admin-editable per category, duration and listing value, an iOS price is whatever the
 * product is set to in App Store Connect. */
exports.APPLE_PRODUCT_PREFIX = "com.finfolia.bhavano.";
const id = (suffix) => `${exports.APPLE_PRODUCT_PREFIX}${suffix}`;
exports.APPLE_SUBSCRIPTIONS = [
    { productId: id("plus.1m"), tier: "buyerPremium", months: 1 },
    { productId: id("plus.6m"), tier: "buyerPremium", months: 6 },
    { productId: id("plus.12m"), tier: "buyerPremium", months: 12 },
    { productId: id("sellerslots.1m"), tier: "sellerSlotPack", months: 1 },
    // One unit only on iOS: In-App Purchase has no quantity, so the web's stackable units don't carry over.
    { productId: id("agentpro.1m"), tier: "agentPro", months: 1 },
];
function appleSubscriptionsFor(tier) {
    return exports.APPLE_SUBSCRIPTIONS.filter((p) => p.tier === tier);
}
exports.APPLE_BOOST_DAYS = [7, 15, 30];
const PROPERTY_CATEGORIES = new Set(["house", "apartment", "villa", "plot", "commercial"]);
const OTHER_CATEGORIES = new Set(["coworking", "pg", "storage"]);
/** The boost tier a listing falls in, or null when iOS has no boost product for it (furniture and
 * interiors are paused). */
function appleBoostTierFor(category) {
    if (PROPERTY_CATEGORIES.has(category))
        return "property";
    if (OTHER_CATEGORIES.has(category))
        return "other";
    return null;
}
function appleBoostProductId(tier, boostDays) {
    return id(`boost.${tier}.${boostDays}d`);
}
exports.APPLE_CREDITS_PRODUCT_ID = id("credits.pack");
/** Every product id, subscriptions first. */
exports.ALL_APPLE_PRODUCT_IDS = [
    ...exports.APPLE_SUBSCRIPTIONS.map((p) => p.productId),
    ...["property", "other"].flatMap((tier) => exports.APPLE_BOOST_DAYS.map((days) => appleBoostProductId(tier, days))),
    exports.APPLE_CREDITS_PRODUCT_ID,
];
/** Boosts and credit packs are consumables (they can be bought again); plans are subscriptions.
 * Matters when finishing a transaction. */
function isAppleConsumableProductId(productId) {
    return productId.startsWith(id("boost.")) || productId === exports.APPLE_CREDITS_PRODUCT_ID;
}
function isAppleProductId(productId) {
    return !!productId && exports.ALL_APPLE_PRODUCT_IDS.includes(productId);
}
