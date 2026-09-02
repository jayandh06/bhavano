"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTABLE_TRANSACTION_TYPES = void 0;
/** Transaction types a poster may choose for each category in the posting wizard's step 2.
 * "buy" is never postable — that's a browsing-side tab, not a lister's action. PG is
 * rent-only, so its step is auto-selected/skipped in the UI. */
exports.POSTABLE_TRANSACTION_TYPES = {
    house: ["sell", "rent", "lease"],
    apartment: ["sell", "rent", "lease"],
    villa: ["sell", "rent", "lease"],
    pg: ["rent"],
    storage: ["rent", "lease"],
    coworking: ["rent", "lease"],
    furniture: ["sell", "rent"],
    interiors: ["sell"],
    plot: ["sell"],
    commercial: ["sell", "rent", "lease"],
};
