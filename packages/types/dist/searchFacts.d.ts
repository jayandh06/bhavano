import type { ListingCategory } from "./index";
import { type FieldOption } from "./categoryFields";
import { type MarketId } from "./market";
/**
 * US search filters on the answers its listing form asks (docs/plans/us-listing-model.md, phase 4). Each is one
 * `?key=value` on a browse page and on `GET /listings`. India has none of these filters.
 */
export declare const SEARCH_FACT_KEYS: readonly ["laundry", "parkingType", "petPolicy", "homeWidth", "purpose", "storageType", "plotType"];
export type SearchFactKey = (typeof SEARCH_FACT_KEYS)[number];
/** Chosen values, at most one per filter. */
export type SearchFacts = Partial<Record<SearchFactKey, string>>;
/** Filters whose stored answer is a list, matched by "contains". */
export declare const MULTI_VALUE_FACTS: ReadonlySet<SearchFactKey>;
export interface SearchFactFilter {
    key: SearchFactKey;
    label: string;
    options: FieldOption[];
}
/** The filters one category offers in a market. */
export declare function searchFactsFor(category: ListingCategory, marketId?: MarketId): SearchFactFilter[];
/** Every value a filter accepts in any US category: what the server allows. */
export declare function searchFactValues(key: SearchFactKey): string[];
/** The filters in a page's query, dropping unknown values. Always empty in India. */
export declare function parseSearchFacts(get: (key: SearchFactKey) => unknown, marketId?: MarketId): SearchFacts;
