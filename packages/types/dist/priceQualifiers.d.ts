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
/** Categories where `price: 0` ("Contact for price") is a legitimate posting — plans/pricing
 * vary enough (PG sharing type, coworking seat type) that no single number is always honest.
 * Single source of truth: `ListingsService.assertValidPrice` enforces this server-side, and
 * PostAdWizard/EditListingForm (web + mobile) gate their own "can I submit?" checks on the same
 * set, so a client-side validity gate can never silently disagree with what the API accepts. */
export declare const PRICE_ON_REQUEST_CATEGORIES: ReadonlySet<ListingCategory>;
