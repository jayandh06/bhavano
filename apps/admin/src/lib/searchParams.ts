/** Both admin filter pages parse ~10 optional string params off Next's async `searchParams`
 * prop, which types each value as `string | string[] | undefined` (repeated query keys become
 * an array) — this narrows to the single-string case every filter field actually wants. */
export function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Every admin list page's page-size selector — kept short and coarse rather than an arbitrary
 * number, so the resulting `?limit=` values stay predictable/bookmarkable. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function parsePageSize(raw: string | undefined): number {
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : 25;
}

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** The query-param names one `<Pagination>` instance reads/writes — defaults to plain
 * `page`/`limit`, but a page with two independently-paginated tables (e.g. a listing detail page
 * showing both "Liked & Viewed" and "Messages") must give each its own pair
 * (`likedPage`/`likedLimit`, `msgPage`/`msgLimit`) so paging one doesn't reset the other. */
export interface PageParamNames {
  page: string;
  limit: string;
}

export const DEFAULT_PAGE_PARAM_NAMES: PageParamNames = { page: "page", limit: "limit" };

/** Carries every current query param forward except `page`, which is set to the target page (and
 * dropped entirely for page 1, so the canonical/no-filter URL never carries a redundant `?page=1`).
 * Replaces every list page's own hand-rolled `loadMoreHref`. */
export function buildPageHref(
  basePath: string,
  sp: SearchParams,
  page: number,
  paramNames: PageParamNames = DEFAULT_PAGE_PARAM_NAMES,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === paramNames.page) continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  if (page > 1) params.set(paramNames.page, String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** A sortable `<th>`'s href — toggles `field` ascending/descending (via a leading `-` on the
 * `sort` param) and clears pagination back to page 1, same as changing any other filter would.
 * Clicking a column that isn't currently sorted starts it ascending; clicking the active column
 * again flips direction. */
export function buildSortHref(basePath: string, sp: SearchParams, field: string): string {
  const currentSort = str(sp.sort);
  const nextSort = currentSort === field ? `-${field}` : field;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "sort" || key === "page") continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  params.set("sort", nextSort);
  return `${basePath}?${params.toString()}`;
}

/** `null` (not sorted on this field), `"asc"`, or `"desc"` — for rendering a sort-direction arrow
 * on the active column header. */
export function sortDirectionFor(sp: SearchParams, field: string): "asc" | "desc" | null {
  const currentSort = str(sp.sort);
  if (currentSort === field) return "asc";
  if (currentSort === `-${field}`) return "desc";
  return null;
}
