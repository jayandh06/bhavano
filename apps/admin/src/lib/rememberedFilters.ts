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
 * Next's own RSC-fetch cache-token, appended to the query string of EVERY client-side `<Link>`
 * navigation request — a real click, a soft navigation, or a background prefetch alike, not just
 * the ones this module already has to reason about. An otherwise-bare navigation the visitor
 * perceives as "/page-visits" arrives at middleware.ts as "/page-visits?_rsc=<token>" — read as a
 * real query (which is all `currentQuery !== ""` checks anywhere in this module see), that looks
 * exactly like a deliberate destination and silently overwrites whatever was remembered with just
 * that token, discarding the real filter. This must be stripped before anything else runs: a raw
 * `fetch`/curl reproduction of the same navigation sequence never sends `_rsc` at all, which is
 * why testing this module's logic directly (or against a plain HTTP client) never caught it — only
 * an actual browser's client-side router does.
 */
export function stripFrameworkParams(query: string): string {
  const params = new URLSearchParams(query);
  params.delete("_rsc");
  return params.toString();
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

/** The explicit signal a "Reset"/"Clear filters" link carries, e.g. `?__clearFilters=1` — see
 * decideFilterAction's own comment for why this exists instead of inferring the same intent from
 * Referer. Exported so every screen's Reset link and AdminListingsTable's `hrefResetting` build
 * the exact same param rather than retyping the string. */
export const CLEAR_FILTERS_PARAM = "__clearFilters";

export type FilterAction =
  | { type: "restore"; query: string }
  | { type: "write"; saved: Record<string, string> }
  /** Like "write" (persists `saved`), but middleware.ts must ALSO redirect to the bare pathname —
   * unlike an ordinary write, the incoming URL here carries a marker param that must never reach
   * the rendered page or get remembered as part of "the filter". */
  | { type: "reset"; saved: Record<string, string> }
  | { type: "noop" };

/**
 * The single decision middleware.ts needs to make on every matched request: restore a remembered
 * filter, remember the current one, clear it, or do nothing.
 *
 * A bare URL (no query, no `CLEAR_FILTERS_PARAM`) is a fresh arrival at this screen — from
 * elsewhere, a brand new tab, or a bookmark — and restores whatever was last remembered, if
 * anything.
 *
 * An earlier version tried to tell that apart from a deliberate "clear filters" navigation (also a
 * bare-looking URL) by checking whether the Referer's pathname matched this one — reasoning that
 * only an in-page reset link, not a fresh arrival, would navigate to this exact same screen's own
 * bare path. That reasoning had a real hole: the admin nav renders a link to EVERY screen,
 * including whichever one is currently on screen, and clicking that "you are here" tab — an
 * entirely normal thing to do, not a reset — produces the exact same signal (bare URL, Referer ==
 * this pathname) as an actual Reset click. Every such click silently wiped the remembered filter,
 * which is why filters looked like they "stopped working after switching tabs a few times" rather
 * than failing outright — it only took one accidental re-click of the current tab, not a bug in
 * every navigation.
 *
 * So a reset is now its own explicit, unambiguous signal instead of an inference: every "Reset"
 * link carries `CLEAR_FILTERS_PARAM=1` in its href, and ONLY that marker clears the remembered
 * filter. A same-pathname Referer is no longer consulted for anything.
 */
export function decideFilterAction(input: {
  pathname: string;
  /** `nextUrl.searchParams.toString()` for the current request — the raw query, before dropping
   * `page` or `CLEAR_FILTERS_PARAM`. */
  currentQuery: string;
  /** Whatever `parseSavedFilters` returned for the request's cookie. */
  saved: Record<string, string>;
}): FilterAction {
  const { pathname, currentQuery, saved } = input;
  const params = new URLSearchParams(currentQuery);

  if (params.has(CLEAR_FILTERS_PARAM)) {
    // Always acts, even if this path was already remembered as cleared — the marker still has to
    // be redirected away so it never reaches the rendered page or lingers in the address bar.
    return { type: "reset", saved: withRemembered(saved, pathname, "") };
  }

  if (currentQuery !== "") {
    const toStore = persistableQuery(currentQuery);
    if (saved[pathname] === toStore) return { type: "noop" };
    return { type: "write", saved: withRemembered(saved, pathname, toStore) };
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
