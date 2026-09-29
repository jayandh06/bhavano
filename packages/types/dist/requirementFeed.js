"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIREMENT_FEED_POSTED_WITHIN_DAYS = void 0;
exports.decodeRequirementFeedQuery = decodeRequirementFeedQuery;
exports.encodeRequirementFeedQuery = encodeRequirementFeedQuery;
const requirementQuestions_1 = require("./requirementQuestions");
exports.REQUIREMENT_FEED_POSTED_WITHIN_DAYS = [7, 30];
/** `rentLease` reads badly in a URL; everything else is its own slug. */
const INTENT_SLUGS = {
    buy: "buy",
    rentLease: "rent-lease",
    pg: "pg",
    furniture: "furniture",
    interiors: "interiors",
};
const MOVE_INS = ["now", "month", "quarter", "exploring"];
const TRANSACTIONS = ["sell", "rent", "lease"];
const ATTRIBUTE_PREFIX = "attr_";
const SLUG_LIKE = /^[a-zA-Z0-9_-]{1,80}$/;
function first(value) {
    return Array.isArray(value) ? value[0] : value;
}
function list(value, max = 20) {
    const raw = first(value);
    if (!raw)
        return undefined;
    const items = [...new Set(raw.split(",").map((v) => v.trim()).filter((v) => SLUG_LIKE.test(v)))].slice(0, max);
    return items.length ? items : undefined;
}
function positiveInt(value) {
    const raw = first(value);
    if (!raw || !/^\d{1,12}$/.test(raw))
        return undefined;
    const n = Number(raw);
    return n > 0 ? n : undefined;
}
/**
 * Reads filters from a query. Anything unrecognised is dropped rather than refused: these URLs are
 * shared and bookmarked, and a stale value should widen the list, not break the page.
 */
function decodeRequirementFeedQuery(query) {
    const f = {};
    const city = first(query.city);
    if (city && SLUG_LIKE.test(city))
        f.city = city;
    f.areas = list(query.areas, 5);
    const intentSlug = first(query.intent);
    const intent = requirementQuestions_1.REQUIREMENT_INTENTS.find((i) => INTENT_SLUGS[i.value] === intentSlug)?.value;
    if (intent)
        f.intent = intent;
    const txn = first(query.txn);
    // `buy` is what older captures said for a purchase; listings and this filter say `sell`.
    const transactionType = txn === "buy" ? "sell" : TRANSACTIONS.find((t) => t === txn);
    if (transactionType)
        f.transactionType = transactionType;
    const type = first(query.type);
    if (type && (intent ? requirementQuestions_1.INTENT_CATEGORIES[intent] : Object.values(requirementQuestions_1.INTENT_CATEGORIES).flat()).includes(type)) {
        f.category = type;
    }
    f.minBudget = positiveInt(query.minBudget);
    f.maxBudget = positiveInt(query.maxBudget);
    const bhk = list(query.bhk)
        ?.map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    if (bhk?.length)
        f.bedrooms = bhk.sort((a, b) => a - b);
    f.minSqft = positiveInt(query.minSqft);
    f.maxSqft = positiveInt(query.maxSqft);
    const attributes = {};
    for (const [key, value] of Object.entries(query)) {
        if (!key.startsWith(ATTRIBUTE_PREFIX))
            continue;
        const attrKey = key.slice(ATTRIBUTE_PREFIX.length);
        const values = list(value);
        if (SLUG_LIKE.test(attrKey) && attrKey !== "amenities" && values)
            attributes[attrKey] = values;
    }
    if (Object.keys(attributes).length)
        f.attributes = attributes;
    f.amenities = list(query.amenities, 40);
    const posted = positiveInt(query.posted);
    if (posted && exports.REQUIREMENT_FEED_POSTED_WITHIN_DAYS.includes(posted))
        f.postedWithinDays = posted;
    const moveIn = MOVE_INS.find((m) => m === first(query.movein));
    if (moveIn)
        f.moveIn = moveIn;
    if (first(query.calls) === "1")
        f.openToCalls = true;
    if (first(query.matches) === "1")
        f.matchesMyListings = true;
    if (first(query.sort) === "soonest")
        f.sort = "soonest";
    for (const key of Object.keys(f)) {
        if (f[key] === undefined)
            delete f[key];
    }
    return f;
}
/** The inverse of `decodeRequirementFeedQuery`. Leaves `city` out when `includeCity` is false —
 * the web page carries the city in its path instead. */
function encodeRequirementFeedQuery(f, includeCity = true) {
    const q = {};
    if (includeCity && f.city)
        q.city = f.city;
    if (f.areas?.length)
        q.areas = f.areas.join(",");
    if (f.intent)
        q.intent = INTENT_SLUGS[f.intent];
    if (f.transactionType)
        q.txn = f.transactionType;
    if (f.category)
        q.type = f.category;
    if (f.minBudget)
        q.minBudget = String(f.minBudget);
    if (f.maxBudget)
        q.maxBudget = String(f.maxBudget);
    if (f.bedrooms?.length)
        q.bhk = f.bedrooms.join(",");
    if (f.minSqft)
        q.minSqft = String(f.minSqft);
    if (f.maxSqft)
        q.maxSqft = String(f.maxSqft);
    for (const [key, values] of Object.entries(f.attributes ?? {})) {
        if (values.length)
            q[`${ATTRIBUTE_PREFIX}${key}`] = values.join(",");
    }
    if (f.amenities?.length)
        q.amenities = f.amenities.join(",");
    if (f.postedWithinDays)
        q.posted = String(f.postedWithinDays);
    if (f.moveIn)
        q.movein = f.moveIn;
    if (f.openToCalls)
        q.calls = "1";
    if (f.matchesMyListings)
        q.matches = "1";
    if (f.sort && f.sort !== "newest")
        q.sort = f.sort;
    return q;
}
