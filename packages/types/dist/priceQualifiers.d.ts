import type { ListingCategory, TransactionType } from "./index";
import type { MarketId } from "./market";
import { type AreaUnit } from "./areaUnit";
export interface PriceQualifierOption {
    value: string;
    label: string;
}
/** Every option a poster may pick for a given (category, transactionType), keyed to match
 * `POSTABLE_TRANSACTION_TYPES` in postingRules.ts — the single source of truth the wizard's
 * step-3 price qualifier dropdown, the edit form, and the BFF's validation all read from. */
export declare const PRICE_QUALIFIER_OPTIONS: Record<ListingCategory, Partial<Record<TransactionType, PriceQualifierOption[]>>>;
export declare function getPriceQualifierOptions(category: ListingCategory, transactionType: TransactionType, marketId?: MarketId): PriceQualifierOption[];
/** Categories where `price: 0` ("Contact for price") is a legitimate posting — plans/pricing
 * vary enough (PG sharing type, coworking seat type) that no single number is always honest.
 * Single source of truth: `ListingsService.assertValidPrice` enforces this server-side, and
 * PostAdWizard/EditListingForm (web + mobile) gate their own "can I submit?" checks on the same
 * set, so a client-side validity gate can never silently disagree with what the API accepts. */
export declare const PRICE_ON_REQUEST_CATEGORIES: ReadonlySet<ListingCategory>;
/** Whether a listing also shows its rent as a yearly rate per square foot. The stored price stays the monthly figure. */
export declare function showsAnnualRate(category: ListingCategory, transactionType: TransactionType, marketId?: MarketId): boolean;
/** What a monthly rent comes to per square foot per year, to the cent; null without both figures. */
export declare function annualRatePerSqft(monthly: number, area: number, unit?: AreaUnit): number | null;
/** The monthly rent a yearly rate per square foot comes to, in whole dollars; null without both figures. */
export declare function monthlyFromAnnualRate(rate: number, area: number, unit?: AreaUnit): number | null;
/** "$24.50/sq ft/yr" */
export declare function formatAnnualRate(rate: number): string;
