import type { ListingCategory } from "./index";
/** What the AI search pass hands back for one typed sentence. Every field is optional; a missing field
 * means "not stated", never "unknown". The values are the ones browse pages already accept in their
 * address (`minPrice`, `maxPrice`, `furnished`, `postedBy`, `sharingType`, `bedrooms`, `area`), so the
 * web search bar can build a normal browse URL from it. See docs/plans/ai-sentence-search.md. */
export interface SearchInterpretationDto {
    transactionGroup?: "buy" | "rent-lease";
    category?: ListingCategory;
    bedrooms?: number[];
    minPrice?: number;
    maxPrice?: number;
    furnished?: (typeof SEARCH_FURNISHED_VALUES)[number];
    postedBy?: "owner";
    sharingType?: string;
    /** A real city name from our city list. */
    cityName?: string;
    /** An area as text, spelling corrected; resolved by the destination page like any typed area. */
    areaText?: string;
    /** Short phrases from the sentence that no supported filter can express ("bachelors allowed"). */
    unmatched: string[];
}
export declare const SEARCH_FURNISHED_VALUES: readonly ["unfurnished", "semi", "furnished"];
export declare function matchCityName(raw: string, cityNames: readonly string[]): string | undefined;
/** Turns whatever the model returned into a safe SearchInterpretationDto, or null if nothing usable
 * is left. Pure and strict on purpose: the model's output is never trusted, so a confused or
 * hostile reply can at worst yield a wrong filter, never an unknown value, link or route. */
export declare function sanitizeSearchInterpretation(raw: unknown, ctx: {
    cityNames: readonly string[];
}): SearchInterpretationDto | null;
