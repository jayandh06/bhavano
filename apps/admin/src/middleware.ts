import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  decideFilterAction,
  isExcludedPath,
  parseSavedFilters,
} from "@/lib/rememberedFilters";

/** Restores/remembers each admin screen's filters — see lib/rememberedFilters.ts for the reasoning
 * and why this has to run in middleware rather than a client component: restoring here means the
 * page's own data fetch (a server component reading `searchParams`) only ever runs once, against
 * the right URL, instead of once for a bare visit and again after a client-side redirect.
 *
 * Deliberately not guarded against Next's `<Link>` prefetching the way apps/web's middleware is
 * (see that file's prefetch-header comments) — this app's nav links point at bare index paths,
 * not ones with a filter query baked in, so a background prefetch here only ever hits the
 * "restore" branch (harmless — it just prefetches the right, filtered version) rather than the
 * "remember" branch recording a filter the visitor never actually chose.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  if (isExcludedPath(pathname)) return NextResponse.next();

  const saved = parseSavedFilters(request.cookies.get(COOKIE_NAME)?.value);
  const action = decideFilterAction({
    pathname,
    currentQuery: searchParams.toString(),
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
