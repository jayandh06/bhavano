import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";

export interface HomeTab {
  value: HomeCategoryFilter;
  label: string;
  icon: string;
  /** Property-type sub-filter options nested under this tab — empty for PG/Furniture,
   * which have their own dedicated filter sets entirely unlike real-estate facets. */
  propertyTypes: { value: PropertyTypeFilter; label: string }[];
}

export const HOME_TABS: HomeTab[] = [
  {
    value: "buy",
    label: "Buy",
    icon: "🏡",
    propertyTypes: [
      { value: "house", label: "House" },
      { value: "apartment", label: "Apartment" },
    ],
  },
  {
    value: "rentLease",
    label: "Rent & Lease",
    icon: "🔑",
    propertyTypes: [
      { value: "house", label: "House" },
      { value: "apartment", label: "Apartment" },
      { value: "storage", label: "Storage" },
      { value: "coworking", label: "Coworking" },
    ],
  },
  { value: "pg", label: "PG", icon: "🛏️", propertyTypes: [] },
  { value: "furniture", label: "Furniture", icon: "🛋️", propertyTypes: [] },
];
