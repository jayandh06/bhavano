"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MARKET_ID = exports.MARKETS = void 0;
exports.isMarketId = isMarketId;
exports.getMarket = getMarket;
exports.marketFromPath = marketFromPath;
exports.marketPath = marketPath;
exports.stripMarketPrefix = stripMarketPrefix;
exports.formatMoney = formatMoney;
exports.isValidNationalPhone = isValidNationalPhone;
exports.MARKETS = {
    in: {
        id: "in",
        countryCode: "IN",
        name: "India",
        pathPrefix: "",
        currency: "INR",
        currencySymbol: "₹",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        priceInIndianWords: true,
        areaUnits: ["sqft", "sqm", "acre", "hectare", "cent"],
        phoneDialCode: "91",
        phoneNationalPattern: /^[6-9]\d{9}$/,
        phoneLoginPrimary: true,
        categories: ["house", "apartment", "villa", "pg", "storage", "coworking", "furniture", "interiors", "plot", "commercial"],
        indexable: true,
    },
    us: {
        id: "us",
        countryCode: "US",
        name: "United States",
        pathPrefix: "/us",
        currency: "USD",
        currencySymbol: "$",
        locale: "en-US",
        // Business-day zone for jobs; per-user zones come later (see the plan).
        timeZone: "America/New_York",
        priceInIndianWords: false,
        areaUnits: ["sqft", "acre"],
        phoneDialCode: "1",
        phoneNationalPattern: /^[2-9]\d{2}[2-9]\d{6}$/,
        phoneLoginPrimary: false,
        // Starting set; the wedge decision in the plan may change it. No PG, coworking, plots or furniture/interiors.
        categories: ["house", "apartment", "villa", "storage", "commercial"],
        indexable: false,
    },
};
/** The market every existing deployment and every caller that names none uses. */
exports.DEFAULT_MARKET_ID = "in";
function isMarketId(value) {
    return value === "in" || value === "us";
}
/** The config for a market id, falling back to India for anything unknown or missing so an unset or
 * mistyped value can never change India's behaviour. */
function getMarket(id) {
    return isMarketId(id) ? exports.MARKETS[id] : exports.MARKETS[exports.DEFAULT_MARKET_ID];
}
/** Which market a URL path belongs to: "/us" and "/us/..." are the US, everything else (including "/usa-tools" or
 * "/") is India, so no existing India path is ever claimed. */
function marketFromPath(pathname) {
    const p = pathname.split("?")[0].split("#")[0];
    return p === "/us" || p.startsWith("/us/") ? "us" : exports.DEFAULT_MARKET_ID;
}
/** A path inside the market: India is unchanged, the US is under /us. Input should start with "/". */
function marketPath(id, path) {
    const prefix = exports.MARKETS[id].pathPrefix;
    if (!prefix)
        return path;
    return path === "/" ? prefix : `${prefix}${path}`;
}
/** The path without its market prefix ("/us/austin-tx/rent" becomes "/austin-tx/rent"). */
function stripMarketPrefix(pathname) {
    if (marketFromPath(pathname) !== "us")
        return pathname;
    const rest = pathname.slice("/us".length);
    return rest === "" ? "/" : rest;
}
/** Formats an amount in the market's currency and locale, whole units (no paise or cents). */
function formatMoney(id, amount) {
    const m = exports.MARKETS[id];
    return new Intl.NumberFormat(m.locale, { style: "currency", currency: m.currency, maximumFractionDigits: 0 }).format(amount);
}
/** Whether a national phone number (digits only, no dial code) is valid in the market. */
function isValidNationalPhone(id, digits) {
    return exports.MARKETS[id].phoneNationalPattern.test(digits);
}
