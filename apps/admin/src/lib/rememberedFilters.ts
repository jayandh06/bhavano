/**
 * Remembering each admin screen's filters between visits.
 *
 * Every screen here is a server component that reads its filters from the URL — which is the right
 * design (sorting needs the real order for pagination, and a filtered view stays shareable), but it
 * means the filters live only in the query string. Open a listing from the queue and come back via
 * the nav, and the nav's href is a bare `/`: the filters are gone, and they have to be re-entered
 * from scratch every time.
 *
 * So the last query string is kept per path in `localStorage` and restored when a screen is opened
 * with no query of its own. The logic is here rather than in the component so it can be tested
 * without a browser — the interesting parts are all edge cases.
 */

const PREFIX = "bhavano-admin-filters:";

/** Keyed by path, so each screen remembers its own filters. A detail route's id is part of its
 * path and therefore part of its key, which is harmless: nothing is saved for a path whose URL
 * never carried a query. */
export function storageKey(pathname: string): string {
  return `${PREFIX}${pathname}`;
}

/**
 * What to write to storage for a given URL — everything except `page`.
 *
 * Returning to page 7 of a queue you last looked at yesterday is not "where I was", it is a
 * stale offset into rows that have since moved; the filters are the part worth keeping. `cols`
 * (the listings table's column choice) is kept deliberately: it is view state the visitor chose,
 * and losing it is the same annoyance as losing a filter.
 */
export function persistableQuery(query: string): string {
  const params = new URLSearchParams(query);
  params.delete("page");
  return params.toString();
}

/**
 * The URL to restore, or null to leave the visitor where they are.
 *
 * Only ever restores on the **first** run for a mounted screen, and only when the URL carries no
 * query at all. Both conditions matter:
 *
 * - A URL that already has a query is a deliberate destination — a shared link, a nav item with
 *   its own params, a click through from another screen — and must win over what was stored.
 * - Restoring after the first run would fight the visitor: clearing the filters navigates to a
 *   bare path, and a restore there would put them straight back, making "reset" impossible. After
 *   the first run this module only ever *writes*, so a reset is stored as empty and stays reset.
 */
export function restoreTarget(input: {
  pathname: string;
  /** `searchParams.toString()` for the current URL. */
  currentQuery: string;
  /** Whatever was stored for this path, or null. */
  saved: string | null;
  /** False only on the first effect run after this screen mounted. */
  hydrated: boolean;
}): string | null {
  const { pathname, currentQuery, saved, hydrated } = input;
  if (hydrated) return null;
  if (currentQuery !== "") return null;
  if (!saved) return null;
  return `${pathname}?${saved}`;
}
