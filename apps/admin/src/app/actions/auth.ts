"use server";

import { auth, signIn, signOut } from "@/auth";
import { logout, sendOtp } from "@/lib/bff";

export async function sendOtpAction(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sendOtp(phone);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send OTP" };
  }
}

export async function verifyOtpAction(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    await signIn("phone-otp", { phone, code, redirect: false });
    return { success: true };
  } catch {
    return { success: false, error: "Incorrect OTP" };
  }
}

export async function signInWithGoogleAction(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction(): Promise<void> {
  // Best-effort — a failed logout log call should never block the user from actually signing
  // out (e.g. an already-expired token would 401 here, which is fine to ignore).
  const session = await auth();
  if (session?.accessToken) await logout(session.accessToken).catch(() => {});
  await signOut({ redirectTo: "/login" });
}
