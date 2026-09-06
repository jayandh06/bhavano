import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import type { IconName } from "../Icon";

/** The chip row's vocabulary: the five real category filters plus "all".
 *
 * "all" deliberately isn't a `HomeCategoryFilter` (that type lives in the types package and is
 * validated by the BFF's ListListingsDto). The BFF treats an *absent* `homeCategory` as
 * "everything" — see fetchListings, which only sets the param when it's truthy — so "all" is the
 * absence of the filter, not a new value of it. Mirrors the web app's `HomeTabValue`. */
export type HomeTabValue = HomeCategoryFilter | "all";

export interface HomeTab {
  value: HomeTabValue;
  label: string;
  icon: IconName;
  /** Property-type sub-filter options nested under this tab — empty for All/PG/Furniture/
   * Interiors, which have no real-estate property-type facet. */
  propertyTypes: { value: PropertyTypeFilter; label: string }[];
}

export const HOME_TABS: HomeTab[] = [
  // First, and the default — the mixed feed across every category. Matches the web app, where a
  // city root like /bengaluru lands on the "All" tab rather than silently on Buy.
  { value: "all", label: "All", icon: "allCities", propertyTypes: [] },
  {
    value: "buy",
    label: "Buy",
    icon: "home",
    propertyTypes: [
      { value: "house", label: "House" },
      { value: "apartment", label: "Apartment" },
      { value: "villa", label: "Villa" },
      { value: "plot", label: "Plot" },
      { value: "commercial", label: "Commercial" },
    ],
  },
  {
    value: "rentLease",
    label: "Rent & Lease",
    icon: "key",
    propertyTypes: [
      { value: "house", label: "House" },
      { value: "apartment", label: "Apartment" },
      { value: "villa", label: "Villa" },
      { value: "storage", label: "Storage" },
      { value: "coworking", label: "Coworking" },
      { value: "commercial", label: "Commercial" },
    ],
  },
  { value: "pg", label: "PG", icon: "bed", propertyTypes: [] },
  { value: "furniture", label: "Furniture", icon: "sofa", propertyTypes: [] },
  { value: "interiors", label: "Interiors", icon: "paint", propertyTypes: [] },
];
