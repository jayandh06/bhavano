"use server";

import { signIn, signOut } from "@/auth";
import type { LinkIdentifierResult } from "@bhavano/types";
import { linkPhone, logout, sendOtp } from "@/lib/bff";
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

export async function signInWithGoogleAction(): Promise<void> {
  await signIn("google");
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
