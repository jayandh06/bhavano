"use server";

import { signIn, signOut } from "@/auth";
import { linkPhone, sendOtp } from "@/lib/bff";
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
): Promise<{ success: boolean; error?: string }> {
  try {
    await signIn("phone-otp", { phone, code, redirect: false });
    return { success: true };
  } catch {
    return { success: false, error: "Incorrect OTP" };
  }
}

export async function signInWithGoogleAction(): Promise<void> {
  await signIn("google");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/** Links a verified phone number to the currently logged-in user — used by the profile page
 * for Google-login users completing their profile. Distinct from verifyOtpAction (login). */
export async function linkPhoneAction(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    await linkPhone(session.accessToken, phone, code);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Incorrect OTP" };
  }
}
