import { signIn } from "@/auth";

/**
 * Starts Google sign-in, for the popup window `LoginForm` opens.
 *
 * Mirrors the consumer site's identical route (apps/web/src/app/auth/google/route.ts) — see that
 * file for the full reasoning. `redirectTo` is fixed rather than taken from a query param: admin
 * has exactly one destination after login (`/`), so there is nothing for a caller to choose, and
 * an attacker-supplied value would be an open redirect on the back of a real login.
 */
export async function GET(): Promise<never> {
  await signIn("google", { redirectTo: "/auth/complete" });
  // Unreachable: signIn throws a redirect.
  throw new Error("signIn did not redirect");
}
