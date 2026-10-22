import type { ListingCategory, TransactionType } from "./index";
import { type FieldDef } from "./categoryFields";
/** The seller's most recent ad in a category, for "Use details from your last ad?" on the posting form
 * (docs/plans/post-details-step-experience.md, Phase 2). Only the raw attributes travel; what is safe to reuse is
 * decided by `reuseAttributes` below. */
export interface LastListingDetailsDto {
    category: ListingCategory;
    transactionType: TransactionType;
    attributes: Record<string, unknown>;
}
export declare function isReusableField(field: FieldDef): boolean;
/** Fills the blanks in `current` from `previous` for the fields that are safe to reuse. Never overwrites anything
 * the seller already entered, only copies a value the current form could hold (a select option that still exists),
 * and drops fields the new transaction type hides. Returns the merged attributes and which keys were copied. */
export declare function reuseAttributes(category: ListingCategory, transactionType: TransactionType, current: Record<string, string | string[]>, previous: Record<string, unknown>): {
    attributes: Record<string, string | string[]>;
    copiedKeys: string[];
};
