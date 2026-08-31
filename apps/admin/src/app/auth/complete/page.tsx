import type { Metadata } from "next";
import { auth } from "@/auth";
import { AuthPopupComplete, type AuthPopupResult } from "@/components/AuthPopupComplete";

/** Nothing here is for a reader, and the page exists for a few hundred milliseconds. */
export const metadata: Metadata = {
  title: "Signing in — Bhavano Admin",
  robots: { index: false, follow: false },
};

/** Where Google's callback lands inside the popup.
 *
 * Deliberately not `requireAdmin()` — that redirects on failure, and a redirect inside the popup
 * would just load `/login` a second time in the small window instead of reporting back to the
 * opener. A valid session with the wrong role is a real, expected outcome here (anyone with a
 * Google account can complete the OAuth handshake; only a BFF-assigned role decides admin
 * access), not an error to redirect away from — so it's read directly and turned into a result
 * for the opener to act on. */
export default async function AuthCompletePage() {
  const session = await auth();
  const result: AuthPopupResult =
    session?.accessToken && session.role === "admin"
      ? { ok: true }
      : { ok: false, reason: session?.accessToken ? "unauthorized" : "failed" };
  return <AuthPopupComplete result={result} />;
}
