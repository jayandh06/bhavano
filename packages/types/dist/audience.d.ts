import type { ListingCategory, TransactionType } from "./index";
/** Who an ad is meant to reach, in the words a seller would use — so "reach more buyers" is not
 * said to someone offering a flat for rent or a PG bed. Used by the post-ad confirmation message and
 * the Featured offer. Falls back to the neutral "people" if the type is unknown. */
export declare function audienceFor(category: ListingCategory | null | undefined, transactionType?: TransactionType | null): string;
