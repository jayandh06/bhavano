"use server";

import { redirect } from "next/navigation";
import type { CreateListingInput, ListingDetailDto } from "@bhavano/types";
import { auth } from "@/auth";
import { createListing, recordView, toggleFavourite, uploadPhoto } from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";

// TEMP(auth-gate): posting is open without login for now.
export async function createListingAction(
  input: CreateListingInput,
): Promise<{ success: boolean; error?: string }> {
  let listing: ListingDetailDto;
  try {
    listing = await createListing(input);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create listing" };
  }
  redirect(buildListingPath(listing));
}

export async function uploadPhotoAction(formData: FormData): Promise<{ url?: string; hash?: string; error?: string }> {
  try {
    return await uploadPhoto(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to upload photo" };
  }
}

export async function trackViewAction(listingId: string, viewerKey: string): Promise<void> {
  const session = await auth();
  // Logged-in viewers dedupe by their real BFF user id (consistent across devices);
  // anonymous viewers dedupe by the client-persisted device key.
  await recordView(listingId, viewerKey, session?.accessToken).catch(() => undefined);
}

export type ToggleFavouriteResult = { requiresLogin: true } | { requiresLogin: false; favourited: boolean; likeCount: number };

export async function toggleFavouriteAction(listingId: string): Promise<ToggleFavouriteResult> {
  const session = await auth();
  if (!session?.accessToken) return { requiresLogin: true };

  const result = await toggleFavourite(session.accessToken, listingId);
  return { requiresLogin: false, ...result };
}
