export const MAX_BEDROOMS = 5;

/** The backend's bedroom filter treats the top bucket as "N or more" (see
 * ListingsService.list()), so the top bucket is genuinely 5-or-more listings, not exactly 5 —
 * label it "5+" everywhere rather than implying an exact count. */
export function bedroomLabel(n: number): string {
  return n >= MAX_BEDROOMS ? `${MAX_BEDROOMS}+` : String(n);
}
