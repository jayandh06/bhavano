import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  decideFilterAction,
  isExcludedPath,
  parseSavedFilters,
  stripFrameworkParams,
} from "@/lib/rememberedFilters";

/** Restores/remembers each admin screen's filters — see lib/rememberedFilters.ts for the reasoning
 * and why this has to run in middleware rather than a client component: restoring here means the
 * page's own data fetch (a server component reading `searchParams`) only ever runs once, against
 * the right URL, instead of once for a bare visit and again after a client-side redirect.
 *
 * Three distinct bugs shipped before this actually worked in a real browser, none of them caught
 * by a curl-based reproduction of the same request sequence (curl never sends `_rsc`, never
 * prefetches, and never carries a same-origin Referer the way a browser does):
 *
 * 1. **`_rsc` (fixed via stripFrameworkParams)** — Next's client router appends its own
 *    `?_rsc=<token>` to every `<Link>` navigation, real click or prefetch alike. Read as a real
 *    query, a click on a bare nav link looked exactly like a deliberate destination and silently
 *    overwrote the remembered filter with nothing but that token — the first-noticed cause of
 *    "filters don't survive navigating to another screen and back."
 * 2. **Prefetch of a link that coincides with the current page (fixed via `prefetch={false}`)** —
 *    with (1) fixed, a bare link's request correctly reads as empty, but Next's automatic
 *    prefetch of a link whose target happens to be the page currently on screen (the nav's own
 *    "you are here" tab, or a screen's own "Reset" link) fires a real background request carrying
 *    that same page as its Referer — indistinguishable from an actual click, and this Next version
 *    exposes no header that tells a prefetch apart from a genuine click-driven navigation (both
 *    read `sec-fetch-dest: empty`). So every link whose href can coincide with the current page is
 *    rendered `prefetch={false}` (AdminNav.tsx, every screen's "Reset" link) so the phantom request
 *    never fires.
 * 3. **Referer-based reset detection itself (fixed via an explicit marker, CLEAR_FILTERS_PARAM,
 *    instead) — see decideFilterAction's own comment.** Even with (1) and (2) fixed, a bare
 *    navigation was still ambiguous between "fresh arrival, restore" and "deliberate reset,
 *    don't" — resolved by checking whether the Referer's pathname matched this one. That still had
 *    a real hole: clicking the nav's own tab for the page you're ALREADY on produces that exact
 *    same signal, and isn't a reset at all. This was the one that actually explained "works a few
 *    times, then stops" — it took exactly one such click to silently wipe the remembered filter
 *    for good, not a failure in every navigation.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  if (isExcludedPath(pathname)) return NextResponse.next();

  const saved = parseSavedFilters(request.cookies.get(COOKIE_NAME)?.value);
  const action = decideFilterAction({
    pathname,
    // stripFrameworkParams: Next's own _rsc cache-token rides along on every client-side <Link>
    // navigation and must never be mistaken for a real filter — see that function's own comment.
    currentQuery: stripFrameworkParams(searchParams.toString()),
    saved,
  });

  if (action.type === "noop") return NextResponse.next();

  if (action.type === "restore") {
    const url = request.nextUrl.clone();
    url.search = action.query;
    // 307: preserves the request method, though everything here is a GET anyway. Not cached by
    // the browser — the target depends on a cookie, not just the source URL.
    return NextResponse.redirect(url, 307);
  }

  // "write" persists the current filter as-is. "reset" persists an empty one AND redirects to
  // the bare pathname — the marker that got it here must never reach the rendered page or sit
  // in the address bar.
  const response =
    action.type === "reset" ? NextResponse.redirect(bareUrlFor(request), 307) : NextResponse.next();
  response.cookies.set(COOKIE_NAME, JSON.stringify(action.saved), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // A year — this is a durable per-admin preference, not a session artifact, matching how long
    // the old localStorage version effectively kept it (indefinitely, until manually cleared).
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function bareUrlFor(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.search = "";
  return url;
}

export const config = {
  // Skip API routes, Next internals, and anything that looks like a static file (has a dot in the
  // last path segment) — only real page navigations have filters worth remembering.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
