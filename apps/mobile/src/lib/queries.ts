import { useQuery } from "@tanstack/react-query";
import {
  fetchCities,
  fetchConversations,
  fetchFavourites,
  fetchListingById,
  fetchListings,
  fetchMessages,
  type ListingsQuery,
} from "./bffClient";

export function useListingsQuery(query: ListingsQuery, accessToken?: string | null) {
  return useQuery({
    queryKey: ["listings", query, accessToken],
    queryFn: () => fetchListings(query, accessToken),
  });
}

export function useListingQuery(id: string, accessToken?: string | null) {
  return useQuery({
    queryKey: ["listing", id, accessToken],
    queryFn: () => fetchListingById(id, accessToken),
  });
}

export function useCitiesQuery(q?: string) {
  return useQuery({
    queryKey: ["cities", q ?? ""],
    queryFn: () => fetchCities(q),
  });
}

export function useFavouritesQuery(accessToken: string | null) {
  return useQuery({
    queryKey: ["favourites", accessToken],
    queryFn: () => fetchFavourites(accessToken!),
    enabled: !!accessToken,
  });
}

export function useConversationsQuery(accessToken: string | null) {
  return useQuery({
    queryKey: ["conversations", accessToken],
    queryFn: () => fetchConversations(accessToken!),
    enabled: !!accessToken,
  });
}

export function useMessagesQuery(accessToken: string | null, conversationId: string) {
  return useQuery({
    queryKey: ["messages", conversationId, accessToken],
    queryFn: () => fetchMessages(accessToken!, conversationId),
    enabled: !!accessToken,
  });
}
