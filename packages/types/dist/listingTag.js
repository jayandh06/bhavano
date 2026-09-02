"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveTag = deriveTag;
/** The short badge shown on a listing card ("FOR RENT", "PG", …). Derived rather than stored
 * per-listing so it can never drift from the category/transaction it describes — lives here
 * alongside the other domain rules so the seed scripts can reuse it without pulling in the
 * BFF's Nest DI graph. */
function deriveTag(input) {
    if (input.category === "coworking")
        return "COWORKING";
    if (input.category === "pg")
        return "PG";
    if (input.category === "furniture")
        return "FURNITURE";
    if (input.category === "storage")
        return "STORAGE";
    if (input.category === "interiors")
        return "INTERIORS";
    if (input.category === "plot")
        return "PLOT";
    if (input.category === "commercial")
        return "COMMERCIAL";
    return input.transactionType === "rent" || input.transactionType === "lease" ? "FOR RENT" : "FOR SALE";
}
