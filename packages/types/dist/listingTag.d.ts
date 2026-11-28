import type { ListingCategory, TransactionType } from "./index";
import type { MarketId } from "./market";
/** The short badge shown on a listing card ("FOR RENT", "PG", …). Derived rather than stored
 * per-listing so it can never drift from the category/transaction it describes — lives here
 * alongside the other domain rules so the seed scripts can reuse it without pulling in the
 * BFF's Nest DI graph. */
export declare function deriveTag(input: {
    category: ListingCategory;
    transactionType: TransactionType;
}, marketId?: MarketId): string;
