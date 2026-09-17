import type { CreateRequirementInput, ListingCategory, PropertyTypeFilter, TransactionType } from "@bhavano/types";
import { HOME_TABS, type HomeTabValue } from "../components/home/categories";

/**
 * Derives the `RequirementPrompt` props from the home screen's own filter state — extracted out
 * of `(tabs)/index.tsx` so this mapping is testable without rendering the screen (it has no
 * react-native import of its own). See docs/plans/property-requirements-demand-side.md and
 * RequirementPrompt.tsx's own doc comment for why this exists at all.
 *
 * `category`/`transactionType` mirror seoRoute.ts's own "one representative value for a group"
 * rule (buy -> sell, rentLease -> rent) rather than the multi-category set the tab actually
 * queries with — a Requirement holds one of each, same as SavedSearch. `areaId` is left out of
 * the result entirely: FilterSheet's areaIds is a multi-select set, and "any of these areas" is
 * not a single requirement any more than it is on web (see BrowseListingsView's identical
 * comment on its own areaId).
 */
export function deriveHomeRequirementCriteria(input: {
  category: HomeTabValue;
  propertyType?: PropertyTypeFilter;
  cityId?: string;
  cityName?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms: number[];
}): { criteria: Omit<CreateRequirementInput, "searchLabel">; label: string } {
  const { category, propertyType, cityId, cityName, minPrice, maxPrice, bedrooms } = input;

  const requirementCategory: ListingCategory | undefined =
    category === "pg" || category === "furniture" || category === "interiors" ? category : propertyType;
  const requirementTransactionType: TransactionType | undefined =
    category === "buy" ? "sell" : category === "rentLease" ? "rent" : undefined;

  const categoryLabel = HOME_TABS.find((t) => t.value === category)?.label ?? "All";
  const propertyTypeLabel =
    category === "buy" || category === "rentLease"
      ? HOME_TABS.find((t) => t.value === category)?.subFilter.options.find((o) => o.value === propertyType)?.label
      : undefined;
  const label = [propertyTypeLabel ?? categoryLabel, cityName].filter(Boolean).join(" in ");

  return {
    label,
    criteria: {
      category: requirementCategory,
      transactionType: requirementTransactionType,
      cityId,
      minPrice,
      maxPrice,
      // SavedSearch/Requirement hold one bedroom count, the filter holds a set — take the
      // smallest, which is the least restrictive reading of "2 or 3 BHK" (same rule
      // BrowseListingsView's own criteria construction uses).
      bedrooms: bedrooms.length > 0 ? Math.min(...bedrooms) : undefined,
      landingPath: "mobile-app:home",
    },
  };
}
