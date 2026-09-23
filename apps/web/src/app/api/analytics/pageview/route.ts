import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "bhavano_sid";
const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Records one soft (client-side) navigation — see SoftNavPageViews.
 *
 * Same hop as `/api/analytics/confirm` and `/api/analytics/search`: `bhavano_sid` is httpOnly, so
 * the session id is read here rather than trusted from the client. Under `/api`, so middleware
 * skips this request and does not log a page view of the analytics call itself.
 *
 * Always 204: a dropped analytics write must never surface on the visitor's screen.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) return new NextResponse(null, { status: 204 });

  let body: { path?: unknown };
  try {
    body = (await request.json()) as { path?: unknown };
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 500) : "";
  if (!path.startsWith("/")) return new NextResponse(null, { status: 204 });

  try {
    await fetch(`${BFF_URL}/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        path,
        userAgent: request.headers.get("user-agent") ?? undefined,
      }),
    });
  } catch {
    // Best-effort, same as middleware.ts's waitUntil pageview fetch.
  }
  return new NextResponse(null, { status: 204 });
}
