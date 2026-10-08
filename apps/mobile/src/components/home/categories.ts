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

/** The BFF query param a tab's facet in FilterSheet writes into — `propertyType` for Buy/Rent &
 * Lease, or one of these category-specific JSONB attribute filters (see list-listings.dto.ts) for
 * PG/Furniture/Interiors, which have no property-type facet at all. */
export type SubFilterParam = "propertyType" | "sharingType" | "condition" | "serviceType";

export interface HomeTab {
  value: HomeTabValue;
  label: string;
  icon: IconName;
  /** This tab's facet options, shown as a section in FilterSheet — empty only for "All", which
   * has nothing narrower to offer. `paramKey` says which BFF query param a selection writes to. */
  subFilter: { paramKey: SubFilterParam; options: { value: string; label: string }[] };
}

// Same source of truth the web app's mega menu uses for these three tabs (see
// apps/web/src/lib/homeCategories.ts) — sharing type, condition, service type all come from
// CATEGORY_FIELD_CONFIG so the two apps can't drift on what options exist.
const PG_SHARING_OPTIONS = CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")!.options!;

export const HOME_TABS: HomeTab[] = [
  // First, and the default — the mixed feed across every category. Matches the web app, where a
  // city root like /bengaluru lands on the "All" tab rather than silently on Buy. Nothing
  // narrower to offer, and the Filters button is hidden on this tab anyway.
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
        { value: "commercial", label: "Commercial" },
      ],
    },
  },
  { value: "pg", label: "PG", icon: "bed", subFilter: { paramKey: "sharingType", options: PG_SHARING_OPTIONS } },
  // Promoted to its own tab (was a Rent & Lease sub-option) — nothing narrower to offer, same
  // shape as "all".
  { value: "coworking", label: "Coworking", icon: "building", subFilter: { paramKey: "propertyType", options: [] } },
  // Furniture/Interiors deliberately hidden for now — see web's homeCategories.ts comment and
  // docs/plans/furniture-interiors-paused.md.
];
