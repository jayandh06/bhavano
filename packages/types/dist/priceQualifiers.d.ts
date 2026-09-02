import type { ListingCategory, TransactionType } from "./index";
export interface PriceQualifierOption {
    value: string;
    label: string;
}
/** Every option a poster may pick for a given (category, transactionType), keyed to match
 * `POSTABLE_TRANSACTION_TYPES` in postingRules.ts — the single source of truth the wizard's
 * step-3 price qualifier dropdown, the edit form, and the BFF's validation all read from. */
export declare const PRICE_QUALIFIER_OPTIONS: Record<ListingCategory, Partial<Record<TransactionType, PriceQualifierOption[]>>>;
export declare function getPriceQualifierOptions(category: ListingCategory, transactionType: TransactionType): PriceQualifierOption[];
