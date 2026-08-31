import { signIn } from "@/auth";

/**
 * Starts Google sign-in, for the popup window `AuthGateProvider` opens.
 *
 * A route rather than a server action because the popup needs a URL to be opened at:
 * `window.open` navigates, and there is no page in the popup yet to run an action from.
 * `signIn` sets its own PKCE/state cookies and throws a redirect to Google, which Next turns
 * into the 302 the popup follows.
 *
 * `redirectTo` is fixed to the completion page rather than taken from a query param. The
 * destination here is not where the *user* ends up — the popup closes and the opener stays where
 * it was — so there is nothing for a caller to choose, and an attacker-supplied value would be
 * an open redirect on the back of a real login.
 */
export async function GET(): Promise<never> {
  await signIn("google", { redirectTo: "/auth/complete" });
  // Unreachable: signIn throws a redirect.
  throw new Error("signIn did not redirect");
}
