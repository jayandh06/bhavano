"use server";

import { signIn, signOut } from "@/auth";
import type { LinkIdentifierResult } from "@bhavano/types";
import { linkPhone, logout, sendOtp } from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";
import { auth } from "@/auth";

export async function sendOtpAction(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sendOtp(phone);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send OTP" };
  }
}

export async function verifyOtpAction(
  phone: string,
  code: string,
): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> {
  try {
    await signIn("phone-otp", { phone, code, redirect: false });
    // isNewUser only reflects this login (see the Session type's isNewUser doc comment) — read
    // it now, right after signing in, rather than expecting callers to trust it on future reads.
    const session = await auth();
    return { success: true, isNewUser: session?.isNewUser };
  } catch {
    return { success: false, error: "Incorrect OTP" };
  }
}

/** `redirectTo` is where NextAuth lands the user after the Google round trip. Without it the
 * default is "/", which is why signing in from /post used to dump the user on the listings page
 * with their intent forgotten.
 *
 * Only same-origin paths are honoured. This value reaches the server from the client, so an
 * unchecked pass-through would be an open redirect: "//evil.example" is a protocol-relative URL
 * that browsers treat as absolute. Requiring a single leading slash rejects both that and any
 * scheme-qualified URL. */
export async function signInWithGoogleAction(redirectTo?: string): Promise<void> {
  const safe = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : undefined;
  await signIn("google", safe ? { redirectTo: safe } : undefined);
}

/** The current session's BFF access token, if any.
 *
 * For the posting wizard, which now renders logged out and only asks for a login at submit: the
 * token arrives as a server-rendered prop, so a wizard that resumes its submission the instant
 * the login dialog closes still holds the `undefined` it mounted with. `router.refresh()` will
 * deliver the real one, but not before the resumed upload needs it. */
export async function getAccessTokenAction(): Promise<string | undefined> {
  const session = await auth();
  return isAccessTokenValid(session?.accessToken) ? session?.accessToken : undefined;
}

/** Whether this browser now holds a valid session.
 *
 * For the Google popup: if the window is closed without having reported back, the login may
 * still have succeeded — the message is the normal path, not a guarantee. Asking the server
 * beats leaving the dialog sitting open over a page the user is, in fact, logged into. */
export async function hasSessionAction(): Promise<boolean> {
  const session = await auth();
  return isAccessTokenValid(session?.accessToken);
}

/** Google sign-in is a full-page redirect through NextAuth — there's no synchronous "it just
 * succeeded" moment on the client the way phone-OTP has (see verifyOtpAction), so
 * SignupConversionTracker calls this once the app reloads after the redirect back, to check
 * whether that login was a brand-new Google signup. */
export async function checkNewSignupAction(): Promise<{ isNewUser: boolean; provider?: string }> {
  const session = await auth();
  return { isNewUser: !!session?.isNewUser, provider: session?.provider };
}

export async function signOutAction(): Promise<void> {
  // Best-effort — a failed logout log call should never block the user from actually signing
  // out (e.g. an already-expired token would 401 here, which is fine to ignore).
  const session = await auth();
  if (session?.accessToken) await logout(session.accessToken).catch(() => {});
  await signOut({ redirectTo: "/" });
}

/** Links a verified phone number to the currently logged-in user — used by the profile page
 * for Google-login users completing their profile. Distinct from verifyOtpAction (login). */
export async function linkPhoneAction(
  phone: string,
  code: string,
): Promise<{ success: true; result: LinkIdentifierResult } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    return { success: true, result: await linkPhone(session.accessToken, phone, code) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Incorrect OTP" };
  }
}
