"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTABLE_TRANSACTION_TYPES = void 0;
exports.postableTransactionTypes = postableTransactionTypes;
exports.marketTransactionType = marketTransactionType;
exports.marketDealIssue = marketDealIssue;
exports.allowsPerUnitPrice = allowsPerUnitPrice;
/** Transaction types a poster may choose for each category in the posting wizard's step 2.
 * "buy" is never postable — that's a browsing-side tab, not a lister's action. PG is
 * rent-only, so its step is auto-selected/skipped in the UI. */
exports.POSTABLE_TRANSACTION_TYPES = {
    house: ["sell", "rent", "lease"],
    apartment: ["sell", "rent", "lease"],
    villa: ["sell", "rent", "lease"],
    condo: ["sell", "rent", "lease"],
    townhouse: ["sell", "rent", "lease"],
    room: ["rent"],
    pg: ["rent"],
    storage: ["rent", "lease"],
    coworking: ["rent", "lease"],
    furniture: ["sell", "rent"],
    interiors: ["sell"],
    plot: ["sell"],
    commercial: ["sell", "rent", "lease"],
};
/** Where the US differs (docs/plans/us-listing-model.md): an apartment is a rental (a unit someone owns is sold as a condo
 * or co-op), "lease" is only said of commercial space (a home is rented), and storage is rented. */
const US_TRANSACTION_TYPES = {
    house: ["sell", "rent"],
    apartment: ["rent"],
    condo: ["sell", "rent"],
    townhouse: ["sell", "rent"],
    storage: ["rent"],
    commercial: ["sell", "lease"],
};
/** What a poster may list this category for in a market. India (the default) gets `POSTABLE_TRANSACTION_TYPES` itself. */
function postableTransactionTypes(category, marketId = "in") {
    return (marketId === "us" ? US_TRANSACTION_TYPES[category] : undefined) ?? exports.POSTABLE_TRANSACTION_TYPES[category];
}
/** The transaction to use for a category when one was chosen by tab rather than by category: in the US "rent" and
 * "lease" mean the same intent, and the category says which word applies (commercial space is leased). Anything the
 * category cannot take at all comes back unchanged, for the caller's own check to refuse. */
function marketTransactionType(category, transactionType, marketId = "in") {
    if (marketId === "in" || (transactionType !== "rent" && transactionType !== "lease"))
        return transactionType;
    const offered = postableTransactionTypes(category, marketId);
    return offered.find((t) => t === transactionType) ?? offered.find((t) => t === "rent" || t === "lease") ?? transactionType;
}
/** Why a listing's category and transaction don't go together in a market, or null. India is not checked here: its
 * server has never refused a pair, and this must not start doing so. */
function marketDealIssue(category, transactionType, marketId = "in") {
    if (marketId === "in" || postableTransactionTypes(category, marketId).includes(transactionType))
        return null;
    if (category === "apartment" && transactionType === "sell")
        return "Apartments can only be rented. To sell a unit, list it as a Condo / Co-op.";
    if (category === "commercial" && transactionType === "rent")
        return "Commercial space is listed for lease, not for rent.";
    if (transactionType === "lease")
        return "This property is listed for rent, not for lease.";
    return "This property can't be listed that way.";
}
/** Whether the price may be typed per unit of area. A US lease is a monthly figure, and US commercial rates are quoted per
 * year, so a rate typed there would be read twelve times too high. */
function allowsPerUnitPrice(transactionType, marketId = "in") {
    return transactionType === "sell" || (transactionType === "lease" && marketId === "in");
}
