/** An area landing page (`/{city}/{area}`) with fewer active listings than this is a thin page:
 * a heading and one card. Many of them came from free-text locations (a street address, a pin
 * code) and sat in the sitemap as near-empty pages. Below the threshold the page still works for
 * visitors and still passes link equity, but it is `noindex, follow` and left out of the sitemap;
 * it becomes indexable again by itself once the area has enough listings.
 * See docs/plans/area-page-indexing-and-name-cleanup.md. */
export const MIN_INDEXABLE_AREA_LISTINGS = 2;

export function isThinAreaPage(activeListings: number): boolean {
  return activeListings < MIN_INDEXABLE_AREA_LISTINGS;
}
