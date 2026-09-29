import type { ListingCategory, SellerType } from "./index";
import { CATEGORY_FIELD_CONFIG } from "./categoryFields";

/** "Owner" / "Agent" / "Agent · Sai Realty" (plus "· RERA verified ✓" once admin has checked the
 * agent's RERA number) for a listing's poster, or null when they never said — shown as nothing
 * rather than a guess. See docs/plans/broker-paid-bundles.md. */
export function postedByLabel(postedBy: SellerType | null, agency?: string | null, reraVerified?: boolean): string | null {
  if (postedBy === "owner") return "Owner";
  if (postedBy === "agent") {
    const base = agency ? `Agent · ${agency}` : "Agent";
    return reraVerified ? `${base} · RERA verified ✓` : base;
  }
  return null;
}

/** The per-listing "Posted by Broker / Agent" (`fromBroker`) attribute as a SellerType — null
 * when it's blank. */
export function sellerTypeFromBroker(value: unknown): SellerType | null {
  return value === "yes" ? "agent" : value === "no" ? "owner" : null;
}

/** The `fromBroker` value a new listing in `category` should start with — the account's
 * Owner/Agent answer, still editable per listing. Empty when the category has no such field or
 * the account hasn't answered. */
export function fromBrokerDefault(category: ListingCategory, sellerType: SellerType | null): Record<string, string> {
  if (!sellerType || !CATEGORY_FIELD_CONFIG[category].some((f) => f.key === "fromBroker")) return {};
  return { fromBroker: sellerType === "agent" ? "yes" : "no" };
}
