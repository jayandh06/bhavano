"use server";

import type { LinkIdentifierResult, UpdateProfileInput, UserProfileDto } from "@bhavano/types";
import { auth } from "@/auth";
import {
  BffAuthError,
  confirmAccountMerge,
  deleteAccount,
  fetchProfile,
  requestEmailCode,
  updateProfile,
  verifyEmail,
} from "@/lib/bff";

export type ProfileActionResult = { requiresLogin: true } | { requiresLogin: false; profile: UserProfileDto };

export async function fetchProfileAction(): Promise<ProfileActionResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };
  try {
    return { requiresLogin: false, profile: await fetchProfile(session.accessToken) };
  } catch (error) {
    if (error instanceof BffAuthError) return { requiresLogin: true };
    throw error;
  }
}

/** Email + phone for the `post_ad_success` conversion's Enhanced Conversions user-provided data
 * — the wizard doesn't otherwise have them in scope. Returns an empty object when logged out or
 * on any failure; the conversion still fires, just without in-page user data. */
export async function getUserContactAction(): Promise<{ email?: string; phone?: string }> {
  const session = await auth();
  if (!session?.accessToken) return {};
  try {
    const profile = await fetchProfile(session.accessToken);
    return { email: profile.email ?? undefined, phone: profile.phone ?? undefined };
  } catch {
    return {};
  }
}

export async function updateProfileAction(
  input: UpdateProfileInput,
): Promise<{ success: boolean; error?: string; profile?: UserProfileDto }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    const profile = await updateProfile(session.accessToken, input);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update profile" };
  }
}

/** Sends a 6-digit code to `email`. Verifying an address is what makes it count as identity —
 * an address merely typed into the form is stored but never treated as proof, so Google
 * sign-in will not adopt this account until it is verified. See
 * docs/plans/account-linking-phone-and-email.md. */
export async function requestEmailCodeAction(email: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    await requestEmailCode(session.accessToken, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Couldn't send the code" };
  }
}

export async function verifyEmailAction(
  email: string,
  code: string,
): Promise<{ success: true; result: LinkIdentifierResult } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    return { success: true, result: await verifyEmail(session.accessToken, email, code) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Couldn't verify the code" };
  }
}

/** Executes a merge the user approved after seeing what the other account holds. */
export async function confirmAccountMergeAction(
  identifier: { phone?: string; email?: string; code: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    await confirmAccountMerge(session.accessToken, identifier);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Couldn't merge the accounts" };
  }
}

/** Deletes the account, then the caller is expected to sign out — the session's user no longer
 * has a usable account behind it. */
export async function deleteAccountAction(
  identifier: { phone?: string; email?: string; code: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "Not logged in" };

  try {
    await deleteAccount(session.accessToken, identifier);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Couldn't delete the account" };
  }
}
