import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";

const ACQUISITION_COOKIE = "bhavano_acq";
const SESSION_COOKIE = "bhavano_sid";
// 30 days — long enough to still attribute a signup that happens a few visits after the user's
// first-ever landing, without pinning the cookie down indefinitely.
const ACQUISITION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
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

function safeHostname(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Two independent things happen here, both first-touch/first-visit-of-session only (skipped
 * entirely once their cookie already exists):
 *
 * 1. `bhavano_acq` — a permanent (30-day) cookie capturing the user's very first-ever landing
 *    source, read at signup time (see lib/bff.ts) and persisted once onto the new User row.
 * 2. `bhavano_sid` — a session cookie (no maxAge, dies when the browser closes) identifying this
 *    browsing session. The first request of each session fires an async, non-blocking call to
 *    the BFF to log a Visit row (source/medium/campaign/landing path) for it — one row per
 *    session, not per page load. If that session later logs in, AuthService links the Visit to
 *    the user (see auth.service.ts's linkVisitToUser).
 */
export function middleware(request: NextRequest, event: NextFetchEvent): NextResponse {
  const hasAcquisitionCookie = request.cookies.has(ACQUISITION_COOKIE);
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  if (hasAcquisitionCookie && hasSessionCookie) return NextResponse.next();

  const resolved = resolveSource(request);
  const response = NextResponse.next();

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
