import type { Area } from "@bhavano/types";
import { buildBrowsePath } from "@/lib/listingPath";
import {
  bedroomLabel,
  CATEGORY_LABELS,
  categoryGroupsFor,
  facetKindForCategory,
  type ParsedSegments,
  type TransactionGroup,
} from "@/lib/seoRoute";

const MAX_SIBLING_AREAS = 8;
const BHK_FACETS = [1, 2, 3, 4, 5] as const;

export interface BrowseSeoLink {
  label: string;
  href: string;
}

export interface BrowseSeoCopy {
  introParagraphs: string[];
  relatedLinks: BrowseSeoLink[];
}

export interface BrowseSeoCopyInput {
  heading: string;
  cityName: string;
  areaName?: string;
  segments: ParsedSegments;
  listingTotal: number;
  cityAreas: Area[];
}

function siblingAreaLinks(cityName: string, cityAreas: Area[], currentAreaName?: string, limit = MAX_SIBLING_AREAS): BrowseSeoLink[] {
  return cityAreas
    .filter((a) => a.name !== currentAreaName)
    .slice(0, limit)
    .map((a) => ({
      label: a.name,
      href: buildBrowsePath({ cityName, areaName: a.name }),
    }));
}

function bhkFacetLinks(
  cityName: string,
  areaName: string | undefined,
  group: TransactionGroup,
  category: "house" | "apartment" | "villa",
  currentFacet?: number,
): BrowseSeoLink[] {
  if (facetKindForCategory(category) !== "bedrooms") return [];
  const catLabel = CATEGORY_LABELS[category];
  return BHK_FACETS.filter((n) => n !== currentFacet).map((n) => ({
    label: `${bedroomLabel(n)} BHK ${catLabel}`,
    href: buildBrowsePath({
      cityName,
      areaName,
      transactionGroup: group,
      category,
      facetValue: n,
    }),
  }));
}

function dedupeLinks(links: BrowseSeoLink[]): BrowseSeoLink[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });
}

function buildRelatedLinks(input: BrowseSeoCopyInput): BrowseSeoLink[] {
  const { cityName, areaName, segments, cityAreas } = input;
  const { transactionGroup: group, category, facetValue } = segments;
  const links: BrowseSeoLink[] = [];

  if (areaName && category && group) {
    const catLabel = CATEGORY_LABELS[category];

    if (facetValue !== undefined && (category === "house" || category === "apartment" || category === "villa")) {
      const bedroom = typeof facetValue === "number" ? facetValue : undefined;
      links.push({
        label: `All ${catLabel.toLowerCase()} in ${areaName}`,
        href: buildBrowsePath({ cityName, areaName, transactionGroup: group, category }),
      });
      links.push(...bhkFacetLinks(cityName, areaName, group, category, bedroom));
    } else {
      if (category === "house" || category === "apartment" || category === "villa") {
        links.push(...bhkFacetLinks(cityName, areaName, group, category));
      }
      links.push({
        label: `${areaName} overview`,
        href: buildBrowsePath({ cityName, areaName }),
      });
    }
    links.push(...siblingAreaLinks(cityName, cityAreas, areaName, 5));
  } else if (areaName) {
    for (const g of ["buy", "rent-lease"] as const) {
      if (!categoryGroupsFor("apartment").includes(g)) continue;
      links.push({
        label: `Apartments ${g === "buy" ? "for sale" : "for rent"} in ${areaName}`,
        href: buildBrowsePath({ cityName, areaName, transactionGroup: g, category: "apartment" }),
      });
    }
    links.push({
      label: `Houses for sale in ${areaName}`,
      href: buildBrowsePath({ cityName, areaName, transactionGroup: "buy", category: "house" }),
    });
    links.push(...siblingAreaLinks(cityName, cityAreas, areaName));
  } else if (category && group) {
    const catLabel = CATEGORY_LABELS[category];
    // Categories postable under both groups (furniture, house/apartment/villa, commercial) are
    // otherwise a dead end: the group is fixed by the path and the page has no control to flip
    // it, so a visitor on "furniture for sale" has no route to "furniture for rent" short of
    // reopening the header mega menu. This is the only on-page link between the two, and it goes
    // first so it survives the 12-link cap below.
    const otherGroup = categoryGroupsFor(category).find((g) => g !== group);
    if (otherGroup) {
      links.push({
        label: `${catLabel} ${otherGroup === "buy" ? "for sale" : "for rent"} in ${cityName}`,
        href: buildBrowsePath({ cityName, transactionGroup: otherGroup, category }),
      });
    }
    if (category === "house" || category === "apartment" || category === "villa") {
      const bedroom = typeof facetValue === "number" ? facetValue : undefined;
      if (facetValue !== undefined) {
        links.push({
          label: `All ${catLabel.toLowerCase()} in ${cityName}`,
          href: buildBrowsePath({ cityName, transactionGroup: group, category }),
        });
        links.push(...bhkFacetLinks(cityName, undefined, group, category, bedroom));
      } else {
        links.push(...bhkFacetLinks(cityName, undefined, group, category));
      }
    }
    for (const area of cityAreas.slice(0, MAX_SIBLING_AREAS)) {
      links.push({
        label: `${catLabel} in ${area.name}`,
        href: buildBrowsePath({
          cityName,
          areaName: area.name,
          transactionGroup: group,
          category,
          facetValue: facetValue,
        }),
      });
    }
  } else if (group) {
    links.push({
      label: group === "buy" ? `Buy in ${cityName}` : `Rent & lease in ${cityName}`,
      href: buildBrowsePath({ cityName, transactionGroup: group }),
    });
    links.push(...siblingAreaLinks(cityName, cityAreas, undefined, 6));
  } else {
    links.push({
      label: `Apartments for sale in ${cityName}`,
      href: buildBrowsePath({ cityName, transactionGroup: "buy", category: "apartment" }),
    });
    links.push({
      label: `Apartments for rent in ${cityName}`,
      href: buildBrowsePath({ cityName, transactionGroup: "rent-lease", category: "apartment" }),
    });
    links.push(...siblingAreaLinks(cityName, cityAreas, undefined, 6));
  }

  return dedupeLinks(links).slice(0, 12);
}

function buildIntroParagraphs(input: BrowseSeoCopyInput): string[] {
  const { heading, cityName, areaName, listingTotal } = input;

  if (listingTotal === 0) {
    return [
      `There are no active listings for ${heading.toLowerCase()} right now.`,
      `You can post a free ad on Bhavano or browse other categories and localities in ${cityName}.`,
    ];
  }

  const paragraphs = [
    `Browse ${listingTotal} listings for ${heading.toLowerCase()} on Bhavano. Ads are posted directly by owners and agents — no login required to search.`,
  ];

  if (areaName) {
    paragraphs.push(
      `Use the filters below to narrow by price or furnishing, or follow the links to explore other neighbourhoods in ${cityName}.`,
    );
  } else {
    paragraphs.push(
      `Select a locality in the area filter or use the links below to drill into neighbourhoods across ${cityName}.`,
    );
  }

  return paragraphs;
}

/** Template intro copy and in-content internal links for SEO browse landing pages. */
export function buildBrowseSeoCopy(input: BrowseSeoCopyInput): BrowseSeoCopy {
  return {
    introParagraphs: buildIntroParagraphs(input),
    relatedLinks: buildRelatedLinks(input),
  };
}
