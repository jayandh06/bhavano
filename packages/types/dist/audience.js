"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audienceFor = audienceFor;
/** Who an ad is meant to reach, in the words a seller would use — so "reach more buyers" is not
 * said to someone offering a flat for rent or a PG bed. Used by the post-ad confirmation message and
 * the Featured offer. Falls back to the neutral "people" if the type is unknown. */
function audienceFor(category, transactionType) {
    switch (category) {
        case "pg":
            return "people looking for a PG";
        case "coworking":
            return "teams and freelancers";
        case "storage":
            return "people looking for storage";
        case "interiors":
            return "customers";
        case "furniture":
            return "buyers";
        case "house":
        case "apartment":
        case "villa":
        case "plot":
        case "commercial":
            if (transactionType === "rent" || transactionType === "lease")
                return "tenants";
            if (transactionType === "buy" || transactionType === "sell")
                return "buyers";
            return "people";
        default:
            return "people";
    }
}
