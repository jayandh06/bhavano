import { NextResponse } from "next/server";

/**
 * Tells Chrome's Privacy Preserving Prefetch Proxy not to send this origin speculative
 * background-prefetch traffic — see the `Sec-Purpose`/`Purpose: prefetch` check in
 * middleware.ts, which is a different, complementary fix: that one stops a prefetch from being
 * mistaken for a real visit (corrupting `bhavano_city`/analytics) once it arrives; this file
 * stops the request from being sent at all, which the cookie/analytics check alone can't do —
 * every prefetch still runs a full uncached page render (every BFF fetch in this app is
 * `cache: "no-store"`, see lib/bff.ts) and hits Postgres, for a page the visitor may never look
 * at. `disallow: true` rather than a `fraction` throttle: with nothing cached, this app gets
 * essentially none of prefetching's usual "instant subsequent navigation" upside to trade away.
 *
 * Fetched by Google's proxy infrastructure itself, not by visitors' browsers, and cached there
 * per ordinary HTTP semantics — see
 * https://developer.chrome.com/blog/private-prefetch-proxy#3p-only.
 *
 * The exact `application/trafficadvice+json` content type is load-bearing: this route (not a
 * static file under public/) exists so that type can be set precisely, since a static file
 * server would otherwise guess a generic type from the extension-less filename.
 */
export function GET() {
  const advice = [{ user_agent: "prefetch-proxy", disallow: true }];
  return new NextResponse(JSON.stringify(advice), {
    headers: { "Content-Type": "application/trafficadvice+json" },
  });
}
