/**
 * Remembering each admin screen's filters between visits.
 *
 * Every screen here is a server component that reads its filters from the URL — which is the
 * right design (sorting needs the real order for pagination, and a filtered view stays
 * shareable) — but it means restoring a remembered filter has to change the URL before that
 * screen renders, not after. A client-side approach (localStorage + a `router.replace()` once
 * mounted) tried that first and always cost a second render: the server component fetches once
 * for the bare URL, the client then discovers the saved filter and replaces the URL, and the
 * server component fetches *again* for the real one. `localStorage` simply isn't readable during
 * server rendering, so there was no way to avoid that from the client side.
 *
 * This version instead keeps the last query string per path in a single cookie, decided and
 * written entirely in `middleware.ts` — server-side, before any page renders, so a remembered
 * filter is applied in the same request that fetches data, and a bare visit with nothing to
 * restore costs nothing extra. The decision logic lives here rather than in the middleware file
 * so it can be tested without spinning up a request/response pair — the interesting parts are all
 * edge cases.
 */

export const COOKIE_NAME = "bhavano_admin_filters";

/** Caps how many distinct paths this remembers at once, evicting the least-recently-touched entry
 * past this. Cookies have a real size ceiling (~4KB) that localStorage never did — this is
 * comfortably above the number of actual filtered index screens (about a dozen), and only matters
 * if id-suffixed detail routes ever start carrying their own persisted query params too. */
export const MAX_REMEMBERED_PATHS = 40;

/** Paths whose query string is never "a screen's filters" — NextAuth's own callback/error params
 * — so they must never be written to or restored from. */
export function isExcludedPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth/");
}

/** Safe parse of the cookie's stored value. Never throws: a corrupted or tampered cookie (this is
 * client-writable in the sense that any cookie is) just reads as "nothing remembered yet" rather
 * than breaking the request. */
export function parseSavedFilters(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // fall through
  }
  return {};
}

/**
 * What to remember for a given URL — everything except `page`.
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

export type FilterAction =
  | { type: "restore"; query: string }
  | { type: "write"; saved: Record<string, string> }
  | { type: "noop" };

/**
 * The single decision middleware.ts needs to make on every matched request: restore a remembered
 * filter, remember the current one, or do nothing.
 *
 * - A URL that already carries a query is a deliberate destination — a shared link, a nav item
 *   with its own params, a click through from another screen — so it always wins: it's simply
 *   remembered as-is (dropping `page`), never overridden by what was stored before.
 * - A bare URL (no query at all) is ambiguous on its own: it's either a fresh arrival at this
 *   screen (from elsewhere, or a brand new tab) that should restore whatever was last remembered,
 *   or a deliberate in-page reset — a "clear filters" link on this same screen, navigating to its
 *   own bare path — that must NOT be immediately undone by restoring the old filter right back.
 *   `refererPathname` is what tells these apart: if the visitor was already on this exact
 *   pathname, this is a reset, and gets remembered as empty so it stays cleared; otherwise it's a
 *   fresh arrival, and restores. This relies on the browser actually sending a same-origin
 *   Referer, which a stripped/blocked one would defeat — the failure mode there is just "the
 *   reset doesn't stick until next visit", not a wrong answer that lasts.
 */
export function decideFilterAction(input: {
  pathname: string;
  /** `nextUrl.searchParams.toString()` for the current request — the raw query, before dropping
   * `page`. */
  currentQuery: string;
  /** The pathname portion of the Referer header, or null if absent/unparseable/cross-origin. */
  refererPathname: string | null;
  /** Whatever `parseSavedFilters` returned for the request's cookie. */
  saved: Record<string, string>;
}): FilterAction {
  const { pathname, currentQuery, refererPathname, saved } = input;

  if (currentQuery !== "") {
    const toStore = persistableQuery(currentQuery);
    if (saved[pathname] === toStore) return { type: "noop" };
    return { type: "write", saved: withRemembered(saved, pathname, toStore) };
  }

  if (refererPathname === pathname) {
    // Deliberate in-page reset. Remembering it as "" (rather than deleting the key) is what makes
    // the reset stick: the restore check below treats an empty string the same as nothing saved.
    if (saved[pathname] === "" || !(pathname in saved)) return { type: "noop" };
    return { type: "write", saved: withRemembered(saved, pathname, "") };
  }

  const rememberedQuery = saved[pathname];
  if (!rememberedQuery) return { type: "noop" };
  return { type: "restore", query: rememberedQuery };
}

/** Re-inserts `pathname` at the end (most-recently-touched) and evicts the oldest entry once over
 * the cap — object key order is insertion order for these non-numeric string keys, so deleting
 * then re-adding is what makes this an LRU rather than a fixed slot. */
function withRemembered(
  saved: Record<string, string>,
  pathname: string,
  value: string,
): Record<string, string> {
  const next = { ...saved };
  delete next[pathname];
  next[pathname] = value;
  const paths = Object.keys(next);
  if (paths.length > MAX_REMEMBERED_PATHS) delete next[paths[0]];
  return next;
}
