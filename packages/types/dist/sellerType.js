"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTED_BY_FORM_OPTIONS = exports.POSTED_BY_FORM_LABEL = void 0;
exports.postedByLabel = postedByLabel;
exports.sellerTypeFromBroker = sellerTypeFromBroker;
exports.hasFromBrokerField = hasFromBrokerField;
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
/** Whether `category`'s form has the per-listing `fromBroker` field. Where it does, that field is
 * the post form's one Owner/Agent question (shown as Owner | Broker / Agent buttons and required
 * before Preview); the separate "Are you the owner or an agent?" block is only for categories
 * without it. Asking both let a switched-off field silently count as "owner". */
function hasFromBrokerField(category) {
    return categoryFields_1.CATEGORY_FIELD_CONFIG[category].some((f) => f.key === "fromBroker");
}
/** How the post/edit forms present `fromBroker`: named answers, Owner first, instead of the
 * config's Yes/No (which reads backwards under "Posted by Broker / Agent" for an owner). */
exports.POSTED_BY_FORM_LABEL = "Posted by";
exports.POSTED_BY_FORM_OPTIONS = [
    { value: "no", label: "Owner" },
    { value: "yes", label: "Broker / Agent" },
];
/** The `fromBroker` value a new listing in `category` should start with — the account's
 * Owner/Agent answer, still editable per listing. Empty when the category has no such field or
 * the account hasn't answered. */
function fromBrokerDefault(category, sellerType) {
    if (!sellerType || !hasFromBrokerField(category))
        return {};
    return { fromBroker: sellerType === "agent" ? "yes" : "no" };
}
