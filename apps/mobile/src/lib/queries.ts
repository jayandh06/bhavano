import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchAreas,
  fetchCities,
  fetchConversations,
  fetchFavourites,
  fetchListingById,
  fetchListings,
  fetchMessages,
  type ListingsQuery,
} from "./bffClient";

/** Cursor-based infinite scroll (FlatList `onEndReached` → `fetchNextPage`) — mobile has no
 * SEO/crawlable-URL reason to use numbered pages the way the web app's browse pages do (see
 * docs/plans/mobile-filters-and-sort.md), so this is the natural fit instead. */
export function useInfiniteListingsQuery(query: Omit<ListingsQuery, "cursor">, accessToken?: string | null) {
  return useInfiniteQuery({
    queryKey: ["listings", query, accessToken],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchListings({ ...query, cursor: pageParam }, accessToken),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useListingQuery(id: string, accessToken?: string | null) {
  return useQuery({
    queryKey: ["listing", id, accessToken],
    queryFn: () => fetchListingById(id, accessToken),
  });
}

export function useCitiesQuery(q?: string, all?: boolean) {
  return useQuery({
    queryKey: ["cities", q ?? "", !!all],
    queryFn: () => fetchCities(q, all),
  });
}

/** The city's full area list, for FilterSheet's Areas section — `all=true` mirrors the web
 * AreaFilter's own fetch (see docs/plans/mobile-filters-and-sort.md). */
export function useAreasQuery(cityId: string | undefined) {
  return useQuery({
    queryKey: ["areas", cityId],
    queryFn: () => fetchAreas(cityId!, undefined, true),
    enabled: !!cityId,
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
