import type { ListingCategory } from "@bhavano/types";
import type { HomeTabValue } from "./homeCategories";
import { CATEGORY_LABELS, categoryGroupsFor, segmentsForHomeCategory } from "./seoRoute";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";

/**
 * Which attribute filters a given asset type has, derived from `CATEGORY_FIELD_CONFIG` rather
 * than hardcoded — Phase 2 of docs/plans/contextual-search-filters.md.
 *
 * That config already describes every field of every category for the posting wizard, both edit
 * forms and the listing detail page, and the BFF's `ListListingsDto` already derives its accepted
 * *values* from it (`SHARING_TYPE_VALUES`, `CONDITION_VALUES`, `SERVICE_TYPE_VALUES` are all read
 * out of it). So the filter row deriving the same way is not a new idea; it is the filter row
 * catching up with everything else that reads one table instead of holding its own opinion.
 *
 * The hardcoded conditions this replaces were already wrong. `BhkFilter` rendered for
 * `house || apartment`, and furnishing for the same pair — but the config says **villa** has both
 * bedrooms and furnishing, and **commercial** has furnishing. Three filters that exist in the
 * data, are accepted by the BFF, and were unreachable in the UI.
 *
 * Only fields the BFF can actually filter on appear here. `sqft`, `plotAreaSqft` and seat counts
 * are real fields on their categories, but `ListingsQuery` has no parameter for them — offering a
 * control that cannot narrow anything would be worse than not offering it. Adding them is a
 * backend change, deliberately out of this phase.
 */
const FILTERABLE_KEYS = ["bedrooms", "furnished", "sharingType", "condition", "serviceType"] as const;

export type FilterableKey = (typeof FILTERABLE_KEYS)[number];

export interface AssetFilterOption {
  value: string;
  label: string;
}

export interface AssetFilter {
  key: FilterableKey;
  /** The control's own label when nothing is selected — "Furnishing", "Sharing", "Condition". */
  label: string;
  /** For select-type filters. Empty for `bedrooms`, which has its own dedicated component
   * (`BhkFilter`) because its values are a numeric multi-select with an SEO path form. */
  options: AssetFilterOption[];
}

/** Human labels for the filter buttons. The config's own `label` is written for a posting form
 * ("Furnishing status", "Sharing type"), which is too long for a filter pill. */
const FILTER_LABELS: Record<FilterableKey, string> = {
  bedrooms: "BHK",
  furnished: "Furnishing",
  sharingType: "Sharing",
  condition: "Condition",
  serviceType: "Service",
};

export function assetFiltersFor(category: ListingCategory | undefined): AssetFilter[] {
  if (!category) return [];
  const fields = CATEGORY_FIELD_CONFIG[category];
  if (!fields) return [];

  return fields
    .filter((field): field is (typeof fields)[number] & { key: FilterableKey } =>
      (FILTERABLE_KEYS as readonly string[]).includes(field.key),
    )
    .map((field) => ({
      key: field.key,
      label: FILTER_LABELS[field.key],
      // Straight from the config, so a value added to the posting form appears as a filter
      // option without a second edit — and can never drift out of step with what the BFF accepts,
      // since ListListingsDto reads the same array.
      options: (field.options ?? []).map((option) => ({ value: option.value, label: option.label })),
    }));
}

export function hasAssetFilter(category: ListingCategory | undefined, key: FilterableKey): boolean {
  return assetFiltersFor(category).some((filter) => filter.key === key);
}

/**
 * Categories that *are* a transaction choice rather than an asset underneath one.
 *
 * PG, Furniture and Interiors are top-level intents in this product's own vocabulary
 * (`HOME_TABS`), not property types you pick after choosing Buy or Rent. So they never appear in
 * the asset list — offering "Buy → Interiors" would duplicate the Interiors intent under a second
 * name — and it is why the asset filter disappears once one of them is chosen: the intent has
 * already named the asset.
 */
const SELF_INTENT_CATEGORIES: ListingCategory[] = ["pg", "furniture", "interiors"];

/**
 * The asset types selectable under each intent.
 *
 * This is the fix for two things the first version got wrong. It modelled the leading filter as a
 * `TransactionGroup` (buy | rent-lease), but this product's top-level axis is the tab vocabulary —
 * so PG, Furniture and Interiors had nowhere to be, and `/bengaluru/pg` (whose path carries no
 * group at all, since `buildBrowsePath` drops the redundant one for a single-group category)
 * showed "Any" as its transaction and offered houses and apartments as its asset types. Neither
 * made sense.
 */
export function assetsForIntent(intent: HomeTabValue): ListingCategory[] {
  if (SELF_INTENT_CATEGORIES.includes(intent as ListingCategory)) return [];

  const { transactionGroup } = segmentsForHomeCategory(intent);
  if (!transactionGroup) {
    // The All tab offers no asset types, so the asset filter does not render there at all: "any
    // transaction, apartments" is a combination nobody asks for, and an asset list that changes
    // shape depending on whether a transaction is chosen reads as the control being broken. Pick
    // Buy or Rent first, then the assets that transaction actually has.
    return [];
  }
  return (Object.keys(CATEGORY_LABELS) as ListingCategory[]).filter(
    (category) =>
      !SELF_INTENT_CATEGORIES.includes(category) && categoryGroupsFor(category).includes(transactionGroup),
  );
}

/** Whether the asset filter has anything to offer for an intent — exported so a caller laying out
 * the row itself can tell whether it will render. */
export function intentOffersAssets(intent: HomeTabValue): boolean {
  return assetsForIntent(intent).length > 0;
}
