"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEARCH_FURNISHED_VALUES = void 0;
exports.matchCityName = matchCityName;
exports.sanitizeSearchInterpretation = sanitizeSearchInterpretation;
const categoryFields_1 = require("./categoryFields");
exports.SEARCH_FURNISHED_VALUES = ["unfurnished", "semi", "furnished"];
const CATEGORIES = [
    "house",
    "apartment",
    "villa",
    "pg",
    "storage",
    "coworking",
    "furniture",
    "interiors",
    "plot",
    "commercial",
];
const SHARING_TYPES = (categoryFields_1.CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")?.options ?? []).map((o) => o.value);
const MAX_PRICE = 1_000_000_000;
const MAX_BEDROOMS_LISTED = 4;
const MAX_UNMATCHED = 4;
const MAX_TEXT = 60;
function cleanText(value) {
    if (typeof value !== "string")
        return undefined;
    const text = value.replace(/[<>{}\[\]\\"`]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
    return text.length >= 2 ? text : undefined;
}
function cleanPrice(value) {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE)
        return undefined;
    return Math.round(n);
}
/** One-or-two-letter typo tolerance for city names (Levenshtein, no deps). */
function editDistance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const above = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
            diagonal = above;
        }
    }
    return prev[b.length];
}
function matchCityName(raw, cityNames) {
    const wanted = raw.trim().toLowerCase();
    if (!wanted)
        return undefined;
    const exact = cityNames.find((name) => name.toLowerCase() === wanted);
    if (exact)
        return exact;
    // Only fix a typo when exactly one city is that close, and only for names long enough that one
    // or two wrong letters cannot turn one real city into another.
    if (wanted.length < 5)
        return undefined;
    const close = cityNames.filter((name) => editDistance(name.toLowerCase(), wanted) <= (wanted.length >= 8 ? 2 : 1));
    return close.length === 1 ? close[0] : undefined;
}
/** Turns whatever the model returned into a safe SearchInterpretationDto, or null if nothing usable
 * is left. Pure and strict on purpose: the model's output is never trusted, so a confused or
 * hostile reply can at worst yield a wrong filter, never an unknown value, link or route. */
function sanitizeSearchInterpretation(raw, ctx) {
    if (!raw || typeof raw !== "object")
        return null;
    const input = raw;
    const out = { unmatched: [] };
    const group = input.transactionGroup ?? input.transaction;
    if (group === "buy" || group === "rent-lease")
        out.transactionGroup = group;
    else if (group === "rent" || group === "lease")
        out.transactionGroup = "rent-lease";
    if (typeof input.category === "string" && CATEGORIES.includes(input.category)) {
        out.category = input.category;
    }
    if (Array.isArray(input.bedrooms)) {
        const beds = [...new Set(input.bedrooms.map((b) => Number(b)).filter((b) => Number.isInteger(b) && b >= 1 && b <= 10))]
            .sort((a, b) => a - b)
            .slice(0, MAX_BEDROOMS_LISTED);
        if (beds.length > 0)
            out.bedrooms = beds;
    }
    let min = cleanPrice(input.minPrice);
    let max = cleanPrice(input.maxPrice);
    if (min !== undefined && max !== undefined && min > max)
        [min, max] = [max, min];
    if (min !== undefined)
        out.minPrice = min;
    if (max !== undefined)
        out.maxPrice = max;
    if (typeof input.furnished === "string" && exports.SEARCH_FURNISHED_VALUES.includes(input.furnished)) {
        out.furnished = input.furnished;
    }
    if (input.postedBy === "owner")
        out.postedBy = "owner";
    if (typeof input.sharingType === "string" && SHARING_TYPES.includes(input.sharingType)) {
        out.sharingType = input.sharingType;
    }
    const city = cleanText(input.cityName ?? input.city);
    if (city) {
        const matched = matchCityName(city, ctx.cityNames);
        if (matched)
            out.cityName = matched;
    }
    const area = cleanText(input.areaText ?? input.area);
    if (area)
        out.areaText = area;
    if (Array.isArray(input.unmatched)) {
        out.unmatched = input.unmatched
            .map((u) => cleanText(u))
            .filter((u) => Boolean(u))
            .slice(0, MAX_UNMATCHED);
    }
    const gotAnything = out.transactionGroup ||
        out.category ||
        out.bedrooms ||
        out.minPrice !== undefined ||
        out.maxPrice !== undefined ||
        out.furnished ||
        out.postedBy ||
        out.sharingType ||
        out.cityName ||
        out.areaText;
    return gotAnything ? out : null;
}
