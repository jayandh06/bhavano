import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { citySlugForRoute } from "@/lib/cityFromRoute";

const ACQUISITION_COOKIE = "bhavano_acq";
const SESSION_COOKIE = "bhavano_sid";
const CITY_COOKIE = "bhavano_city";
// 30 days — long enough to still attribute a signup that happens a few visits after the user's
// first-ever landing, without pinning the cookie down indefinitely.
const ACQUISITION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
// 90 days. Longer than the acquisition window above because this is a stated preference, not an
// attribution horizon — someone who picked Chennai in March still lives in Chennai in May.
const CITY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

interface ResolvedSource {
  source: string;
  medium?: string;
  campaign?: string;
}

/**
 * Resolves where a visitor came from — UTM params if the landing link was tagged, else the
 * external Referer header's hostname, else "direct". Shared by both cookies below: the permanent
 * first-touch one and the per-session visit log, since it's the same computation either way.
 */
function resolveSource(request: NextRequest): ResolvedSource {
  const { searchParams } = request.nextUrl;
  const utmSource = searchParams.get("utm_source");
  if (utmSource) {
    return {
      source: utmSource,
      medium: searchParams.get("utm_medium") ?? undefined,
      campaign: searchParams.get("utm_campaign") ?? undefined,
    };
  }

  const refererHost = safeHostname(request.headers.get("referer"));
  if (refererHost && refererHost !== request.nextUrl.hostname) {
    return { source: refererHost, medium: "referral" };
  }
  return { source: "direct" };
}

/** The visitor's IP as Caddy saw it.
 *
 * The LAST entry, not the first. Caddy appends the connecting peer to whatever X-Forwarded-For
 * arrived, so a client that sends its own header produces "spoofed, real" — the leftmost value is
 * attacker-controlled and the rightmost is the address Caddy actually observed. With exactly one
 * trusted proxy in front of us, that last hop is the one to trust.
 */
function clientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return undefined;
  const hops = forwarded.split(",").map((v) => v.trim()).filter(Boolean);
  return hops[hops.length - 1];
}

function safeHostname(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Three independent things happen here. The first two are first-touch/first-visit-of-session
 * only (skipped entirely once their cookie already exists); the third tracks an ongoing choice:
 *
 * 1. `bhavano_acq` — a permanent (30-day) cookie capturing the user's very first-ever landing
 *    source, read at signup time (see lib/bff.ts) and persisted once onto the new User row.
 * 2. `bhavano_sid` — a session cookie (no maxAge, dies when the browser closes) identifying this
 *    browsing session. The first request of each session fires an async, non-blocking call to
 *    the BFF to log a Visit row (source/medium/campaign/landing path) for it — one row per
 *    session, not per page load. If that session later logs in, AuthService links the Visit to
 *    the user (see auth.service.ts's linkVisitToUser).
 * 3. `bhavano_city` — the city the visitor is currently looking at, so the homepage and the
 *    account/static pages can open on it next time instead of always on Bengaluru. This has to
 *    live here rather than in the pages that resolve the city, because a Server Component cannot
 *    set a cookie during render. Read by `lib/defaultCity.ts`; see
 *    docs/plans/visitor-location-default-city.md.
 */
export function middleware(request: NextRequest, event: NextFetchEvent): NextResponse {
  const hasAcquisitionCookie = request.cookies.has(ACQUISITION_COOKIE);
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  // undefined = this page says nothing about the city; null = it says "all cities".
  const citySlug = citySlugForRoute(request.nextUrl.pathname, request.nextUrl.searchParams.get("city"));
  const currentCity = request.cookies.get(CITY_COOKIE)?.value;
  // Only write when it actually changes, so the steady state stays a bare NextResponse.next()
  // with no Set-Cookie on every page view.
  const cityChanged =
    citySlug !== undefined && (citySlug === null ? currentCity !== undefined : currentCity !== citySlug);
  if (hasAcquisitionCookie && hasSessionCookie && !cityChanged) return NextResponse.next();

  const resolved = resolveSource(request);
  const response = NextResponse.next();

  if (cityChanged) {
    if (citySlug === null) {
      response.cookies.delete(CITY_COOKIE);
    } else {
      response.cookies.set(CITY_COOKIE, citySlug, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: CITY_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  if (!hasAcquisitionCookie) {
    response.cookies.set(ACQUISITION_COOKIE, JSON.stringify(resolved), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ACQUISITION_COOKIE_MAX_AGE_SECONDS,
    });
  }

  if (!hasSessionCookie) {
    const sessionId = crypto.randomUUID();
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // No maxAge: a session cookie, cleared when the browser closes — reopening later starts a
      // new session/visit.
    });

    event.waitUntil(
      fetch(`${BFF_URL}/analytics/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          source: resolved.source,
          medium: resolved.medium,
          campaign: resolved.campaign,
          landingPath: request.nextUrl.pathname,
          ip: clientIp(request),
        }),
      }).catch(() => {
        // Best-effort — a dropped visit log should never affect the page request itself.
      }),
    );
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals, and anything that looks like a static file (has a dot in
  // the last path segment) — only real page navigations need first-touch/session capture.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
