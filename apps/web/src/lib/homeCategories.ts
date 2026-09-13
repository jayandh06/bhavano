import type { HomeCategoryFilter, ListingCategory } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
import { buildBrowsePath } from "./listingPath";
import { bedroomLabel, type TransactionGroup } from "./seoRoute";
import type { IconName } from "@/components/home/Icon";

export interface MegaMenuLink {
  label: string;
  transactionGroup?: TransactionGroup;
  category?: ListingCategory;
  facetValue?: string | number;
}

export interface MegaMenuColumn1Item {
  value: string;
  label: string;
  /** When present, the label itself is a real link to the "all" view for this item (e.g. every
   * House regardless of BHK) — present whenever there's an unambiguous single target, whether or
   * not `links` also offers a narrower breakdown. Absent only where clicking the label can't mean
   * one specific page (Furniture's condition items: Buy vs Rent is a real fork, not a refinement). */
  href?: (cityName?: string) => string;
  links: (cityName: string) => MegaMenuLink[];
}

/** The tab row's vocabulary: the five real filters plus "all".
 *
 * "all" deliberately does NOT go into `HomeCategoryFilter` (which lives in the types package and
 * is validated by the BFF's ListListingsDto). The BFF already treats an absent `homeCategory` as
 * "everything" — see buildHomeCategoryWhere — so "all" is the absence of a filter, not a new
 * value of one. Keeping it a UI-only concept avoids widening a validated wire type to express
 * something the wire already expressed by omission. */
export type HomeTabValue = HomeCategoryFilter | "all";

export interface HomeTab {
  value: HomeTabValue;
  label: string;
  icon: IconName;
  /** Empty for the "All" tab, which has nothing narrower to offer — `CategoryTabs` renders no
   * dropdown arrow and opens no mega menu when this is empty. */
  column1: MegaMenuColumn1Item[];
}

const BEDROOM_COUNTS = [1, 2, 3, 4, 5];

/** House/Apartment under Buy or Rent & Lease — column 2 is the 5 "N BHK ..." links, each a
 * real clean SEO path (/{city}/{group}/{category}/{Nbhk}) via `buildBrowsePath`. */
function bhkColumn1Item(group: TransactionGroup, actionLabel: string, category: ListingCategory, label: string): MegaMenuColumn1Item {
  return {
    value: category,
    label,
    href: (cityName) => buildBrowsePath({ cityName, transactionGroup: group, category }),
    links: (cityName) =>
      BEDROOM_COUNTS.map((n) => ({
        label: `${actionLabel} ${bedroomLabel(n)} BHK ${label} in ${cityName}`,
        transactionGroup: group,
        category,
        facetValue: n,
      })),
  };
}

/** For a type with no further breakdown worth a second column (Plot, Commercial, Storage,
 * Coworking, PG sharing types, Interiors service types) — the label itself is the one and only
 * link, so `links` stays empty rather than duplicating it as a lone column-2 entry. */
function singleLinkColumn1Item(value: string, label: string, link: Omit<MegaMenuLink, "label">): MegaMenuColumn1Item {
  return {
    value,
    label,
    href: (cityName) => buildBrowsePath({ cityName, transactionGroup: link.transactionGroup, category: link.category, facetValue: link.facetValue }),
    links: () => [],
  };
}

const PG_SHARING_OPTIONS = CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")!.options!;
const FURNITURE_CONDITION_OPTIONS = CATEGORY_FIELD_CONFIG.furniture.find((f) => f.key === "condition")!.options!;
const INTERIORS_SERVICE_OPTIONS = CATEGORY_FIELD_CONFIG.interiors.find((f) => f.key === "serviceType")!.options!;

export const HOME_TABS: HomeTab[] = [
  // First, and the default. Before this existed a city root like /bengaluru rendered "All
  // Listings in Bengaluru" while the Buy tab sat highlighted, because there was no tab for the
  // state the page was actually in.
  {
    value: "all",
    label: "All",
    icon: "allCities",
    column1: [],
  },
  {
    value: "buy",
    label: "Buy",
    icon: "home",
    column1: [
      bhkColumn1Item("buy", "Buy", "house", "House"),
      bhkColumn1Item("buy", "Buy", "apartment", "Apartment"),
      bhkColumn1Item("buy", "Buy", "villa", "Villa"),
      singleLinkColumn1Item("plot", "Plots", { transactionGroup: "buy", category: "plot" }),
      singleLinkColumn1Item("commercial", "Commercial", { transactionGroup: "buy", category: "commercial" }),
    ],
  },
  {
    value: "rentLease",
    label: "Rent & Lease",
    icon: "key",
    column1: [
      bhkColumn1Item("rent-lease", "Rent", "house", "House"),
      bhkColumn1Item("rent-lease", "Rent", "apartment", "Apartment"),
      bhkColumn1Item("rent-lease", "Rent", "villa", "Villa"),
      singleLinkColumn1Item("storage", "Storage", { transactionGroup: "rent-lease", category: "storage" }),
      singleLinkColumn1Item("coworking", "Coworking", { transactionGroup: "rent-lease", category: "coworking" }),
      singleLinkColumn1Item("commercial", "Commercial", { transactionGroup: "rent-lease", category: "commercial" }),
    ],
  },
  {
    value: "pg",
    label: "PG",
    icon: "bed",
    column1: PG_SHARING_OPTIONS.map((opt) =>
      singleLinkColumn1Item(opt.value, opt.label, { transactionGroup: "rent-lease", category: "pg", facetValue: opt.value }),
    ),
  },
  {
    value: "furniture",
    label: "Furniture",
    icon: "sofa",
    column1: FURNITURE_CONDITION_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      // No transactionGroup — furniture is postable as both sell and rent, and the bare
      // `/furniture/{condition}` path deliberately means "either" (see buildQueryForSegments),
      // so clicking the condition itself shows both; Buy/Rent below narrows further.
      href: (cityName?: string) => buildBrowsePath({ cityName, category: "furniture", facetValue: opt.value }),
      links: (city: string) => [
        {
          label: `Buy ${opt.label} Furniture in ${city}`,
          transactionGroup: "buy" as const,
          category: "furniture" as const,
          facetValue: opt.value,
        },
        {
          label: `Rent ${opt.label} Furniture in ${city}`,
          transactionGroup: "rent-lease" as const,
          category: "furniture" as const,
          facetValue: opt.value,
        },
      ],
    })),
  },
  {
    value: "interiors",
    label: "Interiors",
    icon: "paint",
    column1: INTERIORS_SERVICE_OPTIONS.map((opt) =>
      singleLinkColumn1Item(opt.value, opt.label, { transactionGroup: "buy", category: "interiors", facetValue: opt.value }),
    ),
  },
];

/** `cityName` is omitted for national browsing, giving `/buy/apartment/2bhk` rather than
 * `/bengaluru/buy/apartment/2bhk`. */
export function hrefForLink(link: MegaMenuLink, cityName?: string): string {
  return buildBrowsePath({ cityName, transactionGroup: link.transactionGroup, category: link.category, facetValue: link.facetValue });
}
