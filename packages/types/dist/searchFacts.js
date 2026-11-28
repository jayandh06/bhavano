"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTI_VALUE_FACTS = exports.SEARCH_FACT_KEYS = void 0;
exports.searchFactsFor = searchFactsFor;
exports.searchFactValues = searchFactValues;
exports.parseSearchFacts = parseSearchFacts;
const categoryFields_1 = require("./categoryFields");
const market_1 = require("./market");
/**
 * US search filters on the answers its listing form asks (docs/plans/us-listing-model.md, phase 4). Each is one
 * `?key=value` on a browse page and on `GET /listings`. India has none of these filters.
 */
exports.SEARCH_FACT_KEYS = ["laundry", "parkingType", "petPolicy", "homeWidth", "purpose", "storageType", "plotType"];
/** Filters whose stored answer is a list, matched by "contains". */
exports.MULTI_VALUE_FACTS = new Set(["petPolicy"]);
const LABELS = {
    laundry: "Laundry",
    parkingType: "Parking",
    petPolicy: "Pets",
    homeWidth: "Home size",
    purpose: "Property type",
    storageType: "Storage type",
    plotType: "Zoning",
};
/** Answers nobody searches for ("No parking", "No pets"). */
const NOT_SEARCHED = { parkingType: ["none"], laundry: ["none"], petPolicy: ["none"] };
/** The filters one category offers in a market. */
function searchFactsFor(category, marketId = "in") {
    if (marketId !== "us")
        return [];
    const fields = (0, categoryFields_1.categoryFieldsFor)(category, marketId);
    return exports.SEARCH_FACT_KEYS.flatMap((key) => {
        const options = fields.find((f) => f.key === key)?.options?.filter((o) => !NOT_SEARCHED[key]?.includes(o.value));
        return options?.length ? [{ key, label: LABELS[key], options }] : [];
    });
}
/** Every value a filter accepts in any US category: what the server allows. */
function searchFactValues(key) {
    return [...new Set(market_1.MARKETS.us.categories.flatMap((c) => searchFactsFor(c, "us").find((f) => f.key === key)?.options.map((o) => o.value) ?? []))];
}
/** The filters in a page's query, dropping unknown values. Always empty in India. */
function parseSearchFacts(get, marketId = "in") {
    const out = {};
    if (marketId !== "us")
        return out;
    for (const key of exports.SEARCH_FACT_KEYS) {
        const value = get(key);
        if (typeof value === "string" && searchFactValues(key).includes(value))
            out[key] = value;
    }
    return out;
}
