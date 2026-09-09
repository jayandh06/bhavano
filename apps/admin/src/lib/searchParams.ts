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

/** Carries every current query param forward except `page`, which is set to the target page (and
 * dropped entirely for page 1, so the canonical/no-filter URL never carries a redundant `?page=1`).
 * Replaces every list page's own hand-rolled `loadMoreHref`. */
export function buildPageHref(basePath: string, sp: SearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "page") continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
