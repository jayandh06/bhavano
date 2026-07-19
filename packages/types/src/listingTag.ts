import type { ListingCategory, TransactionType } from "./index";

/** The short badge shown on a listing card ("FOR RENT", "PG", …). Derived rather than stored
 * per-listing so it can never drift from the category/transaction it describes — lives here
 * alongside the other domain rules so the seed scripts can reuse it without pulling in the
 * BFF's Nest DI graph. */
export function deriveTag(input: { category: ListingCategory; transactionType: TransactionType }): string {
  if (input.category === "coworking") return "COWORKING";
  if (input.category === "pg") return "PG";
  if (input.category === "furniture") return "FURNITURE";
  if (input.category === "storage") return "STORAGE";
  if (input.category === "interiors") return "INTERIORS";
  return input.transactionType === "rent" || input.transactionType === "lease" ? "FOR RENT" : "FOR SALE";
}
