import type { ListingCategory, TransactionType } from "./index";
import type { MarketId } from "./market";

/** The short badge shown on a listing card ("FOR RENT", "PG", …). Derived rather than stored
 * per-listing so it can never drift from the category/transaction it describes — lives here
 * alongside the other domain rules so the seed scripts can reuse it without pulling in the
 * BFF's Nest DI graph. */
export function deriveTag(input: { category: ListingCategory; transactionType: TransactionType }, marketId: MarketId = "in"): string {
  if (input.category === "coworking") return "COWORKING";
  if (input.category === "pg") return "PG";
  if (input.category === "furniture") return "FURNITURE";
  if (input.category === "storage") return "STORAGE";
  if (input.category === "interiors") return "INTERIORS";
  if (input.category === "plot") return marketId === "us" ? "LAND" : "PLOT";
  if (input.category === "multifamily") return "MULTI-FAMILY";
  if (input.category === "commercial") return "COMMERCIAL";
  return input.transactionType === "rent" || input.transactionType === "lease" ? "FOR RENT" : "FOR SALE";
}
