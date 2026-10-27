import type { ListingSitemapEntry } from "@bhavano/types";
import { MAX_BEDROOMS } from "@bhavano/types/bedrooms";
import { buildBrowsePath } from "@/lib/listingPath";
import { transactionGroupFor } from "@/lib/seoRoute";
import { isThinAreaPage } from "@/lib/seoIndexing";

/** Every browse path that has at least one listing, so the "Explore nearby" links on a page never send visitors or crawlers to a page that is empty
 * and therefore `noindex`. The links used to be built from lists (every area of the city, every bedroom count) without looking at inventory, which is
 * how thousands of near-empty URLs were discovered (Search Console: "Excluded by noindex" 2,459, soft 404s). A plain area page also needs the minimum
 * number of listings (`isThinAreaPage`), the same rule the page itself uses to decide to be indexable. */
export function buildBrowseInventory(entries: ListingSitemapEntry[]): Set<string> {
  const paths = new Set<string>();
  const areaCounts = new Map<string, number>();
  const BEDROOM_CATEGORIES = new Set(["house", "apartment", "villa"]);
  for (const e of entries) {
    const group = transactionGroupFor(e.transactionType);
    const base = { cityName: e.cityName, transactionGroup: group };
    paths.add(buildBrowsePath({ cityName: e.cityName }));
    paths.add(buildBrowsePath(base));
    paths.add(buildBrowsePath({ ...base, category: e.category }));
    paths.add(buildBrowsePath({ ...base, areaName: e.area, category: e.category }));
    const areaKey = `${e.cityName}|${e.area}`;
    areaCounts.set(areaKey, (areaCounts.get(areaKey) ?? 0) + 1);
    if (BEDROOM_CATEGORIES.has(e.category) && e.bedrooms) {
      // Facet n means exactly n bedrooms, and the top value means that many or more (see MAX_BEDROOMS in the listing query).
      const facet = Math.min(e.bedrooms, MAX_BEDROOMS);
      paths.add(buildBrowsePath({ ...base, category: e.category, facetValue: facet }));
      paths.add(buildBrowsePath({ ...base, areaName: e.area, category: e.category, facetValue: facet }));
    }
  }
  for (const [key, count] of areaCounts) {
    if (isThinAreaPage(count)) continue;
    const [cityName, area] = key.split("|");
    paths.add(buildBrowsePath({ cityName, areaName: area }));
  }
  return paths;
}
