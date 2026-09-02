import type { ListingCategory } from "./index";
/**
 * Card chips for a listing, in recipe order, skipping anything the seller left blank.
 *
 * Returns an empty array when nothing is derivable — a category with no recipe, or a listing
 * posted before its attributes were collected. Callers fall back to the stored `specs` column,
 * which is what the ~17 listings that predate this still render.
 */
export declare function deriveCardSpecs(category: ListingCategory, attributes: Record<string, unknown> | null | undefined): string[];
