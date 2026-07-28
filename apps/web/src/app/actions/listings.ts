"use server";

import type { CreateListingInput, ListingDetailDto, UpdateListingInput } from "@bhavano/types";
import type { ListingSlotCapErrorBody } from "@bhavano/types/listingSlots";
import { ListingSlotCapError } from "@/lib/listingSlotErrors";
import { auth } from "@/auth";
import {
  BffAuthError,
  createListing,
  deleteListingVideo,
  fetchMyListings,
  recordView,
  toggleFavourite,
  updateListing,
  uploadPhoto,
} from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";

export type CreateListingResult =
  | { success: true; listing: ListingDetailDto }
  | { success: false; error: string; slotCap?: ListingSlotCapErrorBody };

// Doesn't redirect on success — PostAdWizard shows a boost-benefits step first, so the client
// decides when to navigate to the listing, not the server action.
export async function createListingAction(input: CreateListingInput): Promise<CreateListingResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: "You must be logged in to post an ad." };
  }

  try {
    const listing = await createListing(input, session.accessToken);
    return { success: true, listing };
  } catch (error) {
    if (error instanceof ListingSlotCapError) {
      return { success: false, error: error.message, slotCap: error.body };
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to create listing" };
  }
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

export type DeleteVideoResult = { success: true; listing: ListingDetailDto } | { success: false; error: string };

// Deleting a video carries no file/body, so — unlike adding one (see lib/videoUpload.ts, which
// must bypass Server Actions' 1MB body limit) — this can be a normal server action.
export async function deleteVideoAction(listingId: string, videoId: string): Promise<DeleteVideoResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const listing = await deleteListingVideo(session.accessToken, listingId, videoId);
    return { success: true, listing };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete video" };
  }
}
