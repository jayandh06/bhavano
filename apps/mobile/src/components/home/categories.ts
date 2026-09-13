import type { HomeCategoryFilter } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
import type { IconName } from "../Icon";

/** The chip row's vocabulary: the five real category filters plus "all".
 *
 * "all" deliberately isn't a `HomeCategoryFilter` (that type lives in the types package and is
 * validated by the BFF's ListListingsDto). The BFF treats an *absent* `homeCategory` as
 * "everything" — see fetchListings, which only sets the param when it's truthy — so "all" is the
 * absence of the filter, not a new value of it. Mirrors the web app's `HomeTabValue`. */
export type HomeTabValue = HomeCategoryFilter | "all";

/** The BFF query param a tab's sub-chip row writes into — `propertyType` for Buy/Rent & Lease,
 * or one of these category-specific JSONB attribute filters (see list-listings.dto.ts) for
 * PG/Furniture/Interiors, which have no property-type facet at all. */
export type SubFilterParam = "propertyType" | "sharingType" | "condition" | "serviceType";

export interface HomeTab {
  value: HomeTabValue;
  label: string;
  icon: IconName;
  /** Sub-filter options nested under this tab's chip row — empty only for "All", which has
   * nothing narrower to offer. `paramKey` says which BFF query param a selection writes to. */
  subFilter: { paramKey: SubFilterParam; options: { value: string; label: string }[] };
}

// Same source of truth the web app's mega menu uses for these three tabs (see
// apps/web/src/lib/homeCategories.ts) — sharing type, condition, service type all come from
// CATEGORY_FIELD_CONFIG so the two apps can't drift on what options exist.
const PG_SHARING_OPTIONS = CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")!.options!;
const FURNITURE_CONDITION_OPTIONS = CATEGORY_FIELD_CONFIG.furniture.find((f) => f.key === "condition")!.options!;
const INTERIORS_SERVICE_OPTIONS = CATEGORY_FIELD_CONFIG.interiors.find((f) => f.key === "serviceType")!.options!;

export const HOME_TABS: HomeTab[] = [
  // First, and the default — the mixed feed across every category. Matches the web app, where a
  // city root like /bengaluru lands on the "All" tab rather than silently on Buy. Nothing
  // narrower to offer, so its own sub-chip row never renders (see CategoryChips).
  { value: "all", label: "All", icon: "allCities", subFilter: { paramKey: "propertyType", options: [] } },
  {
    value: "buy",
    label: "Buy",
    icon: "home",
    subFilter: {
      paramKey: "propertyType",
      options: [
        { value: "house", label: "House" },
        { value: "apartment", label: "Apartment" },
        { value: "villa", label: "Villa" },
        { value: "plot", label: "Plot" },
        { value: "commercial", label: "Commercial" },
      ],
    },
  },
  {
    value: "rentLease",
    label: "Rent & Lease",
    icon: "key",
    subFilter: {
      paramKey: "propertyType",
      options: [
        { value: "house", label: "House" },
        { value: "apartment", label: "Apartment" },
        { value: "villa", label: "Villa" },
        { value: "storage", label: "Storage" },
        { value: "coworking", label: "Coworking" },
        { value: "commercial", label: "Commercial" },
      ],
    },
  },
  { value: "pg", label: "PG", icon: "bed", subFilter: { paramKey: "sharingType", options: PG_SHARING_OPTIONS } },
  {
    value: "furniture",
    label: "Furniture",
    icon: "sofa",
    subFilter: { paramKey: "condition", options: FURNITURE_CONDITION_OPTIONS },
  },
  {
    value: "interiors",
    label: "Interiors",
    icon: "paint",
    subFilter: { paramKey: "serviceType", options: INTERIORS_SERVICE_OPTIONS },
  },
];
