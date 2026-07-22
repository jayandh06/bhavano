"use server";

import { redirect } from "next/navigation";
import type { CreateListingInput, ListingDetailDto, UpdateListingInput } from "@bhavano/types";
import { auth } from "@/auth";
import {
  BffAuthError,
  createListing,
  fetchMyListings,
  recordView,
  toggleFavourite,
  updateListing,
  uploadPhoto,
} from "@/lib/bff";
import { buildListingPath } from "@/lib/listingPath";
import { isAccessTokenValid } from "@/lib/session";

export async function createListingAction(
  input: CreateListingInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: "You must be logged in to post an ad." };
  }

  let listing: ListingDetailDto;
  try {
    listing = await createListing(input, session.accessToken);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create listing" };
  }
  // `?posted=true` lets PostSuccessTracker fire a one-time GTM conversion event client-side —
  // a server action's redirect() can't run client code itself after a successful post.
  redirect(`${buildListingPath(listing)}?posted=true`);
}

export async function uploadPhotoAction(formData: FormData): Promise<{ hash?: string; ext?: string; error?: string }> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { error: "You must be logged in to post an ad." };
  }

  try {
    return await uploadPhoto(formData, session.accessToken);
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

export async function fetchMyListingsAction(): Promise<ListingDetailDto[]> {
  const session = await auth();
  if (!session?.accessToken) return [];
  try {
    return await fetchMyListings(session.accessToken);
  } catch (error) {
    if (error instanceof BffAuthError) return [];
    throw error;
  }
}

export type UpdateListingResult = { success: true } | { success: false; error: string };

export async function updateListingAction(listingId: string, input: UpdateListingInput): Promise<UpdateListingResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    await updateListing(session.accessToken, listingId, input);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update listing" };
  }
  return { success: true };
}
