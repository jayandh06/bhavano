import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "bhavano_sid";
const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Records that a real browser engine executed JavaScript on this session — see
 * `Visit.jsConfirmedAt` and the `JsConfirmation` component that calls this.
 *
 * Why this hop exists rather than the browser posting to the BFF directly: `bhavano_sid` is
 * httpOnly, so client JS cannot read it, and it stays that way deliberately. Reading the cookie
 * here keeps the session id server-side while still letting the *fact of the request* come from
 * a real browser, which is the entire signal. A client that could name its own session id would
 * also be a client that could confirm somebody else's.
 *
 * Under `/api`, so middleware.ts's matcher skips it — this must not log a page view of itself.
 * Always answers 204: nothing the caller can do about a failure, and an error toast on a
 * visitor's screen over an analytics flag would be absurd.
 */
export async function POST(): Promise<NextResponse> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  // No session cookie means the middleware never ran for this visitor (or they block cookies).
  // Nothing to attach a confirmation to, and inventing an id here would create a phantom session.
  if (!sessionId) return new NextResponse(null, { status: 204 });

  try {
    await fetch(`${BFF_URL}/analytics/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Best-effort, exactly like the visit/pageview calls in middleware.ts.
  }
  return new NextResponse(null, { status: 204 });
}
