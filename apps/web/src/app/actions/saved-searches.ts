"use server";

import { revalidatePath } from "next/cache";
import type { CreateSavedSearchInput } from "@bhavano/types";
import { auth } from "@/auth";
import { createSavedSearch, deleteSavedSearch } from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";

export type SavedSearchActionResult = { success: true } | { success: false; error: string };

export async function createSavedSearchAction(input: CreateSavedSearchInput): Promise<SavedSearchActionResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: "You must be logged in." };
  }

  try {
    await createSavedSearch(session.accessToken, input);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create saved search" };
  }
  revalidatePath("/saved-searches");
  return { success: true };
}

export async function deleteSavedSearchAction(id: string): Promise<SavedSearchActionResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: "You must be logged in." };
  }

  try {
    await deleteSavedSearch(session.accessToken, id);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete saved search" };
  }
  revalidatePath("/saved-searches");
  return { success: true };
}
