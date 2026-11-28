import type { ListingCategory } from "./index";
import { categoryFieldsFor, type FieldOption } from "./categoryFields";
import { MARKETS, type MarketId } from "./market";

/**
 * US search filters on the answers its listing form asks (docs/plans/us-listing-model.md, phase 4). Each is one
 * `?key=value` on a browse page and on `GET /listings`. India has none of these filters.
 */
export const SEARCH_FACT_KEYS = ["laundry", "parkingType", "petPolicy", "homeWidth", "purpose", "storageType", "plotType"] as const;

export type SearchFactKey = (typeof SEARCH_FACT_KEYS)[number];

/** Chosen values, at most one per filter. */
export type SearchFacts = Partial<Record<SearchFactKey, string>>;

/** Filters whose stored answer is a list, matched by "contains". */
export const MULTI_VALUE_FACTS: ReadonlySet<SearchFactKey> = new Set<SearchFactKey>(["petPolicy"]);

const LABELS: Record<SearchFactKey, string> = {
  laundry: "Laundry",
  parkingType: "Parking",
  petPolicy: "Pets",
  homeWidth: "Home size",
  purpose: "Property type",
  storageType: "Storage type",
  plotType: "Zoning",
};

/** Answers nobody searches for ("No parking", "No pets"). */
const NOT_SEARCHED: Partial<Record<SearchFactKey, string[]>> = { parkingType: ["none"], laundry: ["none"], petPolicy: ["none"] };

export interface SearchFactFilter {
  key: SearchFactKey;
  label: string;
  options: FieldOption[];
}

/** The filters one category offers in a market. */
export function searchFactsFor(category: ListingCategory, marketId: MarketId = "in"): SearchFactFilter[] {
  if (marketId !== "us") return [];
  const fields = categoryFieldsFor(category, marketId);
  return SEARCH_FACT_KEYS.flatMap((key) => {
    const options = fields.find((f) => f.key === key)?.options?.filter((o) => !NOT_SEARCHED[key]?.includes(o.value));
    return options?.length ? [{ key, label: LABELS[key], options }] : [];
  });
}

/** Every value a filter accepts in any US category: what the server allows. */
export function searchFactValues(key: SearchFactKey): string[] {
  return [...new Set(MARKETS.us.categories.flatMap((c) => searchFactsFor(c, "us").find((f) => f.key === key)?.options.map((o) => o.value) ?? []))];
}

/** The filters in a page's query, dropping unknown values. Always empty in India. */
export function parseSearchFacts(get: (key: SearchFactKey) => unknown, marketId: MarketId = "in"): SearchFacts {
  const out: SearchFacts = {};
  if (marketId !== "us") return out;
  for (const key of SEARCH_FACT_KEYS) {
    const value = get(key);
    if (typeof value === "string" && searchFactValues(key).includes(value)) out[key] = value;
  }
  return out;
}
