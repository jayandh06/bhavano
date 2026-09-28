import type { SellerType } from "./index";

/** "Owner" / "Agent" / "Agent · Sai Realty" for a listing's poster, or null when they never said
 * — shown as nothing rather than a guess. See docs/plans/broker-paid-bundles.md, Phase 0. */
export function postedByLabel(postedBy: SellerType | null, agency?: string | null): string | null {
  if (postedBy === "owner") return "Owner";
  if (postedBy === "agent") return agency ? `Agent · ${agency}` : "Agent";
  return null;
}
