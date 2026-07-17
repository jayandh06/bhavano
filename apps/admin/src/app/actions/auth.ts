"use server";

import { signIn, signOut } from "@/auth";
import { sendOtp } from "@/lib/bff";

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
  await signIn("google");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
