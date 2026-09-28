/**
 * Where a checkout was started from, for the places whose sales we want to count — stored on
 * `Payment.source` and shown on the admin Payments page. Carried in the link as `?src=` and passed
 * to the order call; anything not listed here is dropped rather than stored, so a hand-edited link
 * can't invent new values.
 *
 * - `admin_boost_message`: the Boost button (or, in older app versions, the plain link) in the
 *   in-app "Bhavano Admin" Boost message — see docs/plans/admin-in-app-boost-message.md.
 */
export const PURCHASE_SOURCES = ["admin_boost_message"] as const;

export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];

export const PURCHASE_SOURCE_PARAM = "src";

export function parsePurchaseSource(value: string | null | undefined): PurchaseSource | undefined {
  return PURCHASE_SOURCES.find((source) => source === value);
}

export const PURCHASE_SOURCE_LABELS: Record<PurchaseSource, string> = {
  admin_boost_message: "Admin boost message",
};
