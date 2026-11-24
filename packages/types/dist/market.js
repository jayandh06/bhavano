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
exports.nationalPhoneDigits = nationalPhoneDigits;
exports.toE164 = toE164;
exports.phoneErrorMessage = phoneErrorMessage;
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
        phoneNationalLength: 10,
        phoneTrunkPrefix: "0",
        phoneLabel: "10-digit Indian mobile number",
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
        phoneNationalLength: 10,
        phoneTrunkPrefix: "",
        phoneLabel: "10-digit US phone number",
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
/** The national number (digits only) from anything a person types or pastes: with or without the dial code or "+", with
 * spaces, dashes or dots, or with the home trunk prefix ("+91 98765 43210", "09876543210", "(415) 555-2671", "+1 415 555 2671").
 * Null when it is not a valid number in the market. */
function nationalPhoneDigits(id, raw) {
    if (!raw)
        return null;
    const m = exports.MARKETS[id];
    let digits = raw.replace(/\D/g, "");
    const n = m.phoneNationalLength;
    if (digits.length === n + m.phoneDialCode.length && digits.startsWith(m.phoneDialCode)) {
        digits = digits.slice(m.phoneDialCode.length);
    }
    else if (m.phoneTrunkPrefix && digits.length === n + m.phoneTrunkPrefix.length && digits.startsWith(m.phoneTrunkPrefix)) {
        digits = digits.slice(m.phoneTrunkPrefix.length);
    }
    return m.phoneNationalPattern.test(digits) ? digits : null;
}
/** E.164 ("+919876543210", "+14155552671") for a valid number in the market, else null. */
function toE164(id, raw) {
    const national = nationalPhoneDigits(id, raw);
    return national ? `+${exports.MARKETS[id].phoneDialCode}${national}` : null;
}
/** Validation message for a bad phone: "phone must be a 10-digit Indian mobile number" for India. */
function phoneErrorMessage(id) {
    return `phone must be a ${exports.MARKETS[id].phoneLabel}`;
}
