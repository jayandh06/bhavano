"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PURCHASE_SOURCE_LABELS = exports.PURCHASE_SOURCE_PARAM = exports.PURCHASE_SOURCES = void 0;
exports.parsePurchaseSource = parsePurchaseSource;
/**
 * Where a checkout was started from, for the places whose sales we want to count — stored on
 * `Payment.source` and shown on the admin Payments page. Carried in the link as `?src=` and passed
 * to the order call; anything not listed here is dropped rather than stored, so a hand-edited link
 * can't invent new values.
 *
 * - `admin_boost_message`: the Boost button (or, in older app versions, the plain link) in the
 *   in-app "Bhavano Admin" Boost message — see docs/plans/admin-in-app-boost-message.md.
 */
exports.PURCHASE_SOURCES = ["admin_boost_message"];
exports.PURCHASE_SOURCE_PARAM = "src";
function parsePurchaseSource(value) {
    return exports.PURCHASE_SOURCES.find((source) => source === value);
}
exports.PURCHASE_SOURCE_LABELS = {
    admin_boost_message: "Admin boost message",
};
