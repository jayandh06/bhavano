"use server";

import type { UpdateProfileInput, UserProfileDto } from "@bhavano/types";
import { auth } from "@/auth";
import { BffAuthError, fetchProfile, updateProfile } from "@/lib/bff";

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
