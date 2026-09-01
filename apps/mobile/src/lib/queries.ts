import { useEffect } from "react";
import { AppState } from "react-native";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UnreadUpdateEvent } from "@bhavano/types";
import {
  fetchAreas,
  fetchCities,
  fetchConversations,
  fetchFavourites,
  fetchListingById,
  fetchListings,
  fetchMessages,
  fetchUnreadCount,
  type ListingsQuery,
} from "./bffClient";
import { getSocket } from "./socket";
import { setAppBadgeCount } from "./push";

export const UNREAD_QUERY_KEY = ["unread"] as const;

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

/** Total unread messages — the number on the Messages icon's badge. Read anywhere; the live
 * updates are driven once by {@link useUnreadCountSync}, mounted at the app root. */
export function useUnreadCountQuery(accessToken: string | null) {
  return useQuery({
    queryKey: UNREAD_QUERY_KEY,
    queryFn: () => fetchUnreadCount(accessToken!).then((r) => r.count),
    enabled: !!accessToken,
    initialData: 0,
  });
}

/**
 * Keeps `["unread"]` current: pushes from the socket's `unread_update` events (a message
 * arrived, or a thread was read on this or another device) straight into the cache, refetches
 * when the app returns to the foreground, and mirrors the value onto the OS app-icon badge.
 * Mount exactly once, near the root.
 */
export function useUnreadCountSync(accessToken: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      queryClient.setQueryData(UNREAD_QUERY_KEY, 0);
      void setAppBadgeCount(0);
      return;
    }

    const apply = (count: number) => {
      queryClient.setQueryData(UNREAD_QUERY_KEY, count);
      void setAppBadgeCount(count);
    };

    const refetch = () => {
      fetchUnreadCount(accessToken)
        .then((r) => apply(r.count))
        .catch(() => undefined);
    };
    refetch();

    const socket = getSocket(accessToken);
    const onUnread = (e: UnreadUpdateEvent) => apply(e.unreadCount);
    socket.on("unread_update", onUnread);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });

    return () => {
      socket.off("unread_update", onUnread);
      sub.remove();
    };
  }, [accessToken, queryClient]);
}
