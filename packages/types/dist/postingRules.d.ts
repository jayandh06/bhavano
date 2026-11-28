import type { ListingCategory, TransactionType } from "./index";
import type { MarketId } from "./market";
/** Transaction types a poster may choose for each category in the posting wizard's step 2.
 * "buy" is never postable — that's a browsing-side tab, not a lister's action. PG is
 * rent-only, so its step is auto-selected/skipped in the UI. */
export declare const POSTABLE_TRANSACTION_TYPES: Record<ListingCategory, TransactionType[]>;
/** What a poster may list this category for in a market. India (the default) gets `POSTABLE_TRANSACTION_TYPES` itself. */
export declare function postableTransactionTypes(category: ListingCategory, marketId?: MarketId): TransactionType[];
/** The transaction to use for a category when one was chosen by tab rather than by category: in the US "rent" and
 * "lease" mean the same intent, and the category says which word applies (commercial space is leased). Anything the
 * category cannot take at all comes back unchanged, for the caller's own check to refuse. */
export declare function marketTransactionType(category: ListingCategory, transactionType: TransactionType, marketId?: MarketId): TransactionType;
/** Why a listing's category and transaction don't go together in a market, or null. India is not checked here: its
 * server has never refused a pair, and this must not start doing so. */
export declare function marketDealIssue(category: ListingCategory, transactionType: TransactionType, marketId?: MarketId): string | null;
/** Whether the price may be typed per unit of area. A US lease is a monthly figure, and US commercial rates are quoted per
 * year, so a rate typed there would be read twelve times too high. */
export declare function allowsPerUnitPrice(transactionType: TransactionType, marketId?: MarketId): boolean;
