import type { ListingCategory, TransactionType } from "./index";
/** Who an ad is meant to reach, in the words a seller would use — so "reach more buyers" is not
 * said to someone offering a flat for rent or a PG bed. Used by the post-ad confirmation message and
 * the Featured offer. Falls back to the neutral "people" if the type is unknown. */
export declare function audienceFor(category: ListingCategory | null | undefined, transactionType?: TransactionType | null): string;
/** The Review step's button, worded for who this ad is for: "Reach more tenants" on a rental,
 * "Reach more buyers" on a sale, "Reach more PG seekers" on a PG. Short on purpose (it sits on a
 * button), so it uses a tighter noun than `audienceFor`. Falls back to "Reach more people". */
export declare function reachLabelFor(category: ListingCategory | null | undefined, transactionType?: TransactionType | null): string;
