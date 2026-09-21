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
 * Two distinct bugs shipped before this actually worked in a real browser, both invisible to a
 * curl-based reproduction of the same request sequence (curl never sends `_rsc` and never
 * prefetches anything, so both look correct in isolation):
 *
 * 1. **`_rsc` (fixed via stripFrameworkParams)** — Next's client router appends its own
 *    `?_rsc=<token>` to every `<Link>` navigation, real click or prefetch alike. Read as a real
 *    query, a click on a bare nav link looked exactly like a deliberate destination and silently
 *    overwrote the remembered filter with nothing but that token — the actual cause of "filters
 *    don't survive navigating to another screen and back." This was the primary bug; the second
 *    one below only matters once this one no longer masks it.
 * 2. **Prefetch vs. a real reset click (fixed via `prefetch={false}`)** — with (1) fixed, a bare
 *    link's request now correctly reads as empty, but that's ambiguous on its own: a fresh
 *    arrival at a screen (restore) and a deliberate same-screen "clear filters" click (don't
 *    restore) both look like "bare query, "referer" resolves to real signal only for genuine
 *    navigations. Next's automatic prefetch of a link whose target happens to be the page
 *    currently on screen (the nav's own "you are here" tab, or a screen's own "Reset" link)
 *    carries that same page as its Referer, indistinguishable from a real click — and this Next
 *    version exposes no header that tells a prefetch apart from a genuine click-driven navigation
 *    (both read `sec-fetch-dest: empty`, unlike apps/web's middleware, which only needs to tell a
 *    prefetch apart from a real *document* load). So every link whose href can coincide with the
 *    current page is rendered `prefetch={false}` (AdminNav.tsx, and every screen's "Reset" link)
 *    so the phantom request never fires at all, rather than trying to infer intent from headers
 *    this Next version doesn't reliably expose.
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
    refererPathname: refererPathnameOf(request),
    saved,
  });

  if (action.type === "restore") {
    const url = request.nextUrl.clone();
    url.search = action.query;
    // 307: preserves the request method, though everything here is a GET anyway. Not cached by
    // the browser — the target depends on a cookie, not just the source URL.
    return NextResponse.redirect(url, 307);
  }

  if (action.type === "noop") return NextResponse.next();

  const response = NextResponse.next();
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

function refererPathnameOf(request: NextRequest): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).pathname;
  } catch {
    return null;
  }
}

export const config = {
  // Skip API routes, Next internals, and anything that looks like a static file (has a dot in the
  // last path segment) — only real page navigations have filters worth remembering.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
