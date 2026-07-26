import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export interface AdminSession {
  accessToken: string;
  userId: string;
}

/** Reads the `exp` claim out of the BFF-issued access token without verifying its signature —
 * the BFF remains the sole authority on whether the token is actually valid on every real API
 * call, this just avoids proactively using a token we already know has expired. NextAuth's own
 * session cookie lives for 30 days by default, far longer than the BFF token's 1h TTL (see
 * ACCESS_TOKEN_TTL in apps/bff/src/auth/auth.service.ts), so a session can look "logged in" long
 * after the token inside it has gone stale. */
function isExpired(accessToken: string): boolean {
  const payload = accessToken.split(".")[1];
  if (!payload) return true;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof exp !== "number" || exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/** Every admin page calls this first — bounces anyone without a valid, unexpired admin session
 * back to /login rather than ever rendering moderation content for a non-admin, or letting a
 * stale token reach the BFF and surface as an unhandled "Login required" crash mid-render (see
 * docs/plans/admin-session-expiry-fix.md). */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (
    !session?.accessToken ||
    session.role !== "admin" ||
    !session.user?.id ||
    isExpired(session.accessToken)
  ) {
    redirect("/login?error=unauthorized");
  }
  return { accessToken: session.accessToken, userId: session.user.id };
}
