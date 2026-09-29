"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postedByLabel = postedByLabel;
exports.sellerTypeFromBroker = sellerTypeFromBroker;
exports.fromBrokerDefault = fromBrokerDefault;
const categoryFields_1 = require("./categoryFields");
/** "Owner" / "Agent" / "Agent · Sai Realty" (plus "· RERA verified ✓" once admin has checked the
 * agent's RERA number) for a listing's poster, or null when they never said — shown as nothing
 * rather than a guess. See docs/plans/broker-paid-bundles.md. */
function postedByLabel(postedBy, agency, reraVerified) {
    if (postedBy === "owner")
        return "Owner";
    if (postedBy === "agent") {
        const base = agency ? `Agent · ${agency}` : "Agent";
        return reraVerified ? `${base} · RERA verified ✓` : base;
    }
    return null;
}
/** The per-listing "Posted by Broker / Agent" (`fromBroker`) attribute as a SellerType — null
 * when it's blank. */
function sellerTypeFromBroker(value) {
    return value === "yes" ? "agent" : value === "no" ? "owner" : null;
}
/** The `fromBroker` value a new listing in `category` should start with — the account's
 * Owner/Agent answer, still editable per listing. Empty when the category has no such field or
 * the account hasn't answered. */
function fromBrokerDefault(category, sellerType) {
    if (!sellerType || !categoryFields_1.CATEGORY_FIELD_CONFIG[category].some((f) => f.key === "fromBroker"))
        return {};
    return { fromBroker: sellerType === "agent" ? "yes" : "no" };
}
