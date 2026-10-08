import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAccessTokenValid } from "@/lib/session";

const SESSION_COOKIE = "bhavano_sid";
const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Attaches the logged-in caller to this browser session's `Visit` row — the web counterpart to
 * mobile's `linkAnalyticsSessionToUser`/`POST /analytics/link-session` (see that BFF endpoint's
 * own doc comment).
 *
 * `Visit.userId` is otherwise only ever set at the exact moment of an explicit login
 * (AuthService passes the session id then — see `linkVisitToUser`). `bhavano_sid` is a
 * session-only cookie that dies with the browser, while the NextAuth cookie lasts 30 days, so a
 * returning visitor who is still logged in from a previous session never logs in again and that
 * new session's Visit row stayed "anonymous" in the admin Page visits list even though the
 * person was signed in — see docs/plans/analytics-bot-filtering-and-attribution.md's own note
 * that this was fixed for mobile and deliberately not for web. `SessionUserLink` calls this once
 * per session.
 *
 * Same reasoning as the `confirm` route for why this hop exists rather than the browser calling
 * the BFF directly: `bhavano_sid` is httpOnly, so client JS cannot read it, and the access token
 * lives in the NextAuth session cookie, not anywhere client JS can reach either. Reading both
 * here keeps them server-side.
 *
 * Under `/api`, so middleware.ts's matcher skips it — this must not log a page view of itself.
 * Always answers 204: nothing the caller can do about a failure, and an error toast on a
 * visitor's screen over an analytics link would be absurd.
 */
export async function POST(): Promise<NextResponse> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) return new NextResponse(null, { status: 204 });

  const session = await auth();
  if (!isAccessTokenValid(session?.accessToken)) return new NextResponse(null, { status: 204 });

  try {
    await fetch(`${BFF_URL}/analytics/link-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Best-effort, exactly like the confirm/visit/pageview calls elsewhere in this app.
  }
  return new NextResponse(null, { status: 204 });
}
