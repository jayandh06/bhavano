"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audienceFor = audienceFor;
exports.reachLabelFor = reachLabelFor;
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
/** The Review step's button, worded for who this ad is for: "Reach more tenants" on a rental,
 * "Reach more buyers" on a sale, "Reach more PG seekers" on a PG. Short on purpose (it sits on a
 * button), so it uses a tighter noun than `audienceFor`. Falls back to "Reach more people". */
function reachLabelFor(category, transactionType) {
    switch (category) {
        case "pg":
            return "Reach more PG seekers";
        case "coworking":
            return "Reach more teams";
        case "storage":
            return "Reach more renters";
        case "interiors":
            return "Reach more customers";
        default: {
            const audience = audienceFor(category, transactionType);
            return audience === "people" ? "Reach more people" : `Reach more ${audience}`;
        }
    }
}
