import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "bhavano_sid";
const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Records one search a real visitor ran — see `SearchEvent` in the Prisma schema for why nothing
 * captured this before.
 *
 * The hop exists for the same reason `/api/analytics/confirm`'s does: `bhavano_sid` is httpOnly,
 * so the session id is read here rather than trusted from the client. A client that could name
 * its own session could attribute searches to somebody else's.
 *
 * Under `/api`, so middleware.ts's matcher skips it — this must not log a page view of itself.
 * Always answers 204: there is nothing a visitor could do about a failure, and an analytics write
 * has no business surfacing on their screen.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) return new NextResponse(null, { status: 204 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await fetch(`${BFF_URL}/analytics/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Spread first so a caller can never override the session id with one of its own.
      body: JSON.stringify({ ...(body as Record<string, unknown>), sessionId }),
    });
  } catch {
    // Best-effort, exactly like the visit/pageview calls in middleware.ts.
  }
  return new NextResponse(null, { status: 204 });
}
