"use client";

import { useEffect } from "react";
import { checkNewSignupAction } from "@/app/actions/auth";
import { pushDataLayerEvent } from "@/lib/gtm";

const CHECKED_KEY = "bhavano_google_signup_tracked";

/** Fires `signup_complete` for the Google OAuth path — the phone-OTP path already fires it
 * synchronously right at the moment of successful verification (AuthGateProvider.handleVerifyOtp),
 * but Google sign-in is a full-page redirect through NextAuth with no such moment on the client to
 * hook into. Instead: this mounts once per real page load (the root layout doesn't remount on
 * client-side navigation, only on a hard reload or a redirect like this one), and checks the
 * already-populated `session.isNewUser`/`provider` (see auth.ts) right after the app reloads.
 *
 * `isNewUser` stays true in the JWT for the rest of that session (see its doc comment in auth.ts),
 * so a plain check-on-every-mount would refire on every later hard refresh too — the sessionStorage
 * flag (scoped to this browser tab) stops that once it's fired once. This isn't watertight against
 * every edge case (e.g. opening a brand-new tab while the same login is still fresh), but that's an
 * acceptable, rare over-count for an analytics event, not a correctness-critical one. */
export function SignupConversionTracker() {
  useEffect(() => {
    if (sessionStorage.getItem(CHECKED_KEY)) return;

    checkNewSignupAction().then(({ isNewUser, provider }) => {
      if (isNewUser && provider === "google") {
        pushDataLayerEvent("signup_complete", { method: "google" });
        sessionStorage.setItem(CHECKED_KEY, "1");
      }
    });
  }, []);

  return null;
}
