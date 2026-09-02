"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionGroupFor = transactionGroupFor;
exports.buildListingPath = buildListingPath;
const slugify_1 = require("./slugify");
function transactionGroupFor(t) {
    return t === "buy" || t === "sell" ? "buy" : "rent-lease";
}
/** Canonical SEO path for a listing: /{city}/{locality}/{transactionGroup}/{category}/{slug}-{id}.
 * Built entirely from card/detail DTO fields already in hand — no extra fetch needed. Facet
 * (bedroom count/sharing type/condition/service type) is a browse-level filter, not encoded in
 * an individual listing's own canonical URL — see apps/web/src/lib/listingPath.ts's
 * `buildBrowsePath` for that (still web-only: nothing outside the browse UI needs it). */
function buildListingPath(item) {
    const group = transactionGroupFor(item.transactionType);
    return `/${(0, slugify_1.slugify)(item.cityName)}/${(0, slugify_1.slugify)(item.area)}/${group}/${item.category}/${item.slug}-${item.id}`;
}
