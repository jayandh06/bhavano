"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MARKET_ID = exports.MARKETS = void 0;
exports.isMarketId = isMarketId;
exports.getMarket = getMarket;
exports.marketFromPath = marketFromPath;
exports.marketPath = marketPath;
exports.stripMarketPrefix = stripMarketPrefix;
exports.groupAmount = groupAmount;
exports.formatMoney = formatMoney;
exports.isValidNationalPhone = isValidNationalPhone;
exports.nationalPhoneDigits = nationalPhoneDigits;
exports.toE164 = toE164;
exports.phoneErrorMessage = phoneErrorMessage;
exports.marketAreaUnits = marketAreaUnits;
exports.isMarketCategory = isMarketCategory;
exports.isMarketField = isMarketField;
exports.marketDateFormatter = marketDateFormatter;
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
        phonePlaceholder: "10-digit mobile number",
        phoneLoginPrimary: true,
        publishRequiresVerifiedPhone: true,
        phoneOtpAvailable: true,
        paymentsEnabled: true,
        indiaContent: true,
        contactConsentPreTicked: true,
        categories: ["house", "apartment", "villa", "pg", "storage", "coworking", "furniture", "interiors", "plot", "commercial"],
        hiddenFieldKeys: [],
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
        phonePlaceholder: "10-digit phone number",
        phoneLoginPrimary: false,
        publishRequiresVerifiedPhone: false,
        phoneOtpAvailable: false,
        paymentsEnabled: false,
        indiaContent: false,
        contactConsentPreTicked: false,
        // Starting set plus condo, townhouse and room for rent (docs/plans/us-categories-condo-townhouse-room.md); the wedge decision in the plan may change it.
        // No PG, coworking, plots or furniture/interiors.
        categories: ["house", "apartment", "villa", "storage", "commercial", "condo", "townhouse", "room"],
        // The first four are Fair Housing; "entranceFacing" is Vastu (an India convention) and is a required field, so leaving it visible would force every US poster to pick a compass direction.
        hiddenFieldKeys: ["preferredTenantTypes", "vegetariansOnly", "gender", "foodType", "entranceFacing"],
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
/** Whole-unit digits grouped the way the market writes them: "12,50,000" in India (lakh/crore), "1,250,000" in the US.
 * Hand-rolled rather than `toLocaleString` so Node, browsers and Hermes all print the same thing. Negative keeps its sign. */
function groupAmount(id, amount) {
    const rounded = Math.round(Math.abs(amount));
    const sign = amount < 0 && rounded > 0 ? "-" : "";
    const digits = String(rounded);
    if (digits.length <= 3)
        return sign + digits;
    const tail = digits.slice(-3);
    const head = digits.slice(0, -3);
    const grouped = exports.MARKETS[id].priceInIndianWords ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") : head.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // The US groups the tail too: 1250000 -> head "1250" -> "1,250" + ",000".
    return `${sign}${grouped},${tail}`;
}
/** The market's currency symbol and whole-unit amount: "₹12,50,000", "$1,250". Negative: "-$1,250". */
function formatMoney(id, amount) {
    const grouped = groupAmount(id, amount);
    return grouped.startsWith("-") ? `-${exports.MARKETS[id].currencySymbol}${grouped.slice(1)}` : `${exports.MARKETS[id].currencySymbol}${grouped}`;
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
/** The units a field's own list allows (`FieldDef.units`, sq ft when it names none), limited to what the market offers.
 * India offers every unit, so its lists come back unchanged; if none are left the market's default unit stands alone. */
function marketAreaUnits(id, units) {
    const offered = exports.MARKETS[id].areaUnits;
    const allowed = (units ?? ["sqft"]).filter((u) => offered.includes(u));
    return allowed.length > 0 ? allowed : [offered[0]];
}
/** Whether listings of this category can be posted in the market. */
function isMarketCategory(id, category) {
    return exports.MARKETS[id].categories.includes(category);
}
/** Whether a listing or requirement field is offered in the market. */
function isMarketField(id, key) {
    return !exports.MARKETS[id].hiddenFieldKeys.includes(key);
}
const dateFormatters = new Map();
/** An `Intl.DateTimeFormat` in the market's locale ("en-IN" → "24 Nov 2026", "en-US" → "Nov 24, 2026"), cached by options so
 * module-level helpers can ask for it per call instead of fixing the locale at import. */
function marketDateFormatter(id, options) {
    const key = `${id}|${JSON.stringify(options)}`;
    let fmt = dateFormatters.get(key);
    if (!fmt) {
        fmt = new Intl.DateTimeFormat(exports.MARKETS[id].locale, options);
        dateFormatters.set(key, fmt);
    }
    return fmt;
}
