"use client";

import { useEffect } from "react";
import { checkNewSignupAction } from "@/app/actions/auth";
import { pushDataLayerEvent } from "@/lib/gtm";

/** Shared with `AuthGateProvider`, which fires the same event from the popup flow. One key, so
 * whichever path got there first stops the other double-counting a single signup. */
export const GOOGLE_SIGNUP_TRACKED_KEY = "bhavano_google_signup_tracked";

/** Fires `signup_complete` for a Google sign-in that came back as a full-page redirect — which
 * is now only the fallback path, when a popup could not be opened. The popup path fires this
 * itself (see AuthGateProvider.handleGoogle), because it deliberately never reloads the page and
 * so never remounts this component. Both write the same sessionStorage key, so a signup counts
 * once however it happened.
 *
 * The phone-OTP path fires synchronously at the moment of successful verification
 * (AuthGateProvider.handleVerifyOtp); the redirect flow has no such moment on the client, so
 * instead: this mounts once per real page load (the root layout doesn't remount on client-side
 * navigation, only on a hard reload or a redirect like that one), and checks the
 * already-populated `session.isNewUser`/`provider` (see auth.ts) right after the app reloads.
 *
 * `isNewUser` stays true in the JWT for the rest of that session (see its doc comment in auth.ts),
 * so a plain check-on-every-mount would refire on every later hard refresh too — the sessionStorage
 * flag (scoped to this browser tab) stops that once it's fired once. This isn't watertight against
 * every edge case (e.g. opening a brand-new tab while the same login is still fresh), but that's an
 * acceptable, rare over-count for an analytics event, not a correctness-critical one. */
export function SignupConversionTracker() {
  useEffect(() => {
    if (sessionStorage.getItem(GOOGLE_SIGNUP_TRACKED_KEY)) return;

    checkNewSignupAction().then(({ isNewUser, provider, email }) => {
      if (isNewUser && provider === "google") {
        pushDataLayerEvent("signup_complete", {
          method: "google",
          ...(email ? { user_data: { email } } : {}),
        });
        sessionStorage.setItem(GOOGLE_SIGNUP_TRACKED_KEY, "1");
      }
    });
  }, []);

  return null;
}
