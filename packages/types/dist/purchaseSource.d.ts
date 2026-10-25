/**
 * Where a checkout was started from, for the places whose sales we want to count — stored on
 * `Payment.source` and shown on the admin Payments page. Carried in the link as `?src=` and passed
 * to the order call; anything not listed here is dropped rather than stored, so a hand-edited link
 * can't invent new values.
 *
 * - `admin_boost_message`: the Boost button (or, in older app versions, the plain link) in the
 *   in-app "Bhavano Admin" Boost message — see docs/plans/admin-in-app-boost-message.md.
 * - `my_listings`: the Boost button on a listing in My listings (web or app), i.e. the seller came back on their own
 * rather than through the post flow or the admin message.
 */
export declare const PURCHASE_SOURCES: readonly ["admin_boost_message", "my_listings"];
export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];
export declare const PURCHASE_SOURCE_PARAM = "src";
export declare function parsePurchaseSource(value: string | null | undefined): PurchaseSource | undefined;
export declare const PURCHASE_SOURCE_LABELS: Record<PurchaseSource, string>;
