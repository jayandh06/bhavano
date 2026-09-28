import type { PropertyTypeFilter, RequirementCaptureCriteria } from "@bhavano/types";
import { requirementCriteriaFromBrowse } from "@bhavano/types/requirementQuestions";
import { HOME_TABS, type HomeTabValue } from "../components/home/categories";

/**
 * Derives the `RequirementPrompt` props from the home screen's own filter state — extracted out
 * of `(tabs)/index.tsx` so this mapping is testable without rendering the screen (it has no
 * react-native import of its own). See docs/plans/property-requirements-demand-side.md and
 * RequirementPrompt.tsx's own doc comment for why this exists at all.
 *
 * The criteria come from `requirementCriteriaFromBrowse`, the same mapping web's browse pages use
 * (docs/plans/requirement-refinement-questions.md), so a search captured on either app is stored
 * the same way: the tab picks one representative transaction (Buy → sell, Rent & Lease and PG →
 * rent, Interiors → sell), and the area set, the BHK set and the tab's own facet carry through.
 * More than `MAX_REQUIREMENT_AREAS` areas is "anywhere", left for the refinement questions.
 */
export function deriveHomeRequirementCriteria(input: {
  category: HomeTabValue;
  propertyType?: PropertyTypeFilter;
  cityId?: string;
  cityName?: string;
  areaIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  bedrooms: number[];
  furnished?: string;
  sharingType?: string;
  condition?: string;
  serviceType?: string;
}): { criteria: RequirementCaptureCriteria; label: string } {
  const { category, propertyType, cityName } = input;

  const criteria = requirementCriteriaFromBrowse({
    homeCategory: category === "all" ? undefined : category,
    propertyType,
    cityId: input.cityId,
    areaIds: input.areaIds,
    bedrooms: input.bedrooms,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    furnished: input.furnished,
    sharingType: input.sharingType,
    condition: input.condition,
    serviceType: input.serviceType,
  });

  const categoryLabel = HOME_TABS.find((t) => t.value === category)?.label ?? "All";
  const propertyTypeLabel =
    category === "buy" || category === "rentLease"
      ? HOME_TABS.find((t) => t.value === category)?.subFilter.options.find((o) => o.value === propertyType)?.label
      : undefined;
  const label = [propertyTypeLabel ?? categoryLabel, cityName].filter(Boolean).join(" in ");

  return {
    label,
    criteria: { ...criteria, landingPath: "mobile-app:home" },
  };
}
