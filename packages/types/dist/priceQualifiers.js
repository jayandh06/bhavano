"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_QUALIFIER_OPTIONS = void 0;
exports.getPriceQualifierOptions = getPriceQualifierOptions;
/** "" (Fixed price) is a deliberately valid, selectable option for sell listings — it submits
 * as a blank priceQualifier, matching pre-existing sell listings that show no suffix at all. */
const SELL_OPTIONS = [
    { value: "", label: "Fixed price" },
    { value: "onwards", label: "Onwards" },
    { value: "negotiable", label: "Negotiable" },
];
const MONTHLY_OPTIONS = [{ value: "/month", label: "Per month" }];
const COWORKING_RENT_OPTIONS = [
    { value: "/seat/month", label: "Per seat / month" },
    { value: "/month", label: "Per month (whole space)" },
];
const FURNITURE_RENT_OPTIONS = [
    { value: "/day", label: "Per day" },
    { value: "/month", label: "Per month" },
];
/** Every option a poster may pick for a given (category, transactionType), keyed to match
 * `POSTABLE_TRANSACTION_TYPES` in postingRules.ts — the single source of truth the wizard's
 * step-3 price qualifier dropdown, the edit form, and the BFF's validation all read from. */
exports.PRICE_QUALIFIER_OPTIONS = {
    house: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
    apartment: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
    villa: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
    pg: { rent: MONTHLY_OPTIONS },
    storage: { rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
    coworking: { rent: COWORKING_RENT_OPTIONS, lease: COWORKING_RENT_OPTIONS },
    furniture: { sell: SELL_OPTIONS, rent: FURNITURE_RENT_OPTIONS },
    interiors: { sell: SELL_OPTIONS },
    plot: { sell: SELL_OPTIONS },
    commercial: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: MONTHLY_OPTIONS },
};
function getPriceQualifierOptions(category, transactionType) {
    return exports.PRICE_QUALIFIER_OPTIONS[category]?.[transactionType] ?? [];
}
