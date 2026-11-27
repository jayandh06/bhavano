import type { MarketId } from "@bhavano/types/market";

/** The headings of the three price tiers, naming the categories each market offers. `furniture` is absent where the market has no such category:
 * its stored prices are kept and saved unchanged. */
export function tierLabels(marketId: MarketId): { property: string; middle: string; furniture?: string } {
  if (marketId === "us") {
    return { property: "House / Apartment / Condo / Townhouse / Villa / Room / Commercial", middle: "Storage" };
  }
  return { property: "House / Apartment / Villa / Plot / Commercial", middle: "Coworking / PG / Storage", furniture: "Furniture / Interiors" };
}
