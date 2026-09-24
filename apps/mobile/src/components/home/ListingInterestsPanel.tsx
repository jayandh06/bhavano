import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ListingInterestDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import {
  fetchListingInterests,
  openInterestConversation,
} from "../../lib/bffClient";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Owner panel on My listings — who's interested (Level 1 Message-only). */
export function ListingInterestsPanel({
  listingId,
  interestCount,
  accessToken,
}: {
  listingId: string;
  interestCount: number;
  accessToken: string;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ListingInterestDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchListingInterests(accessToken, listingId);
      setItems(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load interested buyers");
    } finally {
      setLoading(false);
    }
  }

  async function onMessage(userId: string, existingConversationId: string | null) {
    if (existingConversationId) {
      router.push(`/messages/${existingConversationId}`);
      return;
    }
    setMessagingUserId(userId);
    try {
      const { conversationId } = await openInterestConversation(accessToken, listingId, userId);
      router.push(`/messages/${conversationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the conversation");
    } finally {
      setMessagingUserId(null);
    }
  }

  if (interestCount <= 0) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <Pressable onPress={() => void toggle()}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.green, textDecorationLine: "underline" }}>
          {open ? "Hide" : "Show"} interested buyers ({interestCount})
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            gap: 10,
            backgroundColor: colors.surface,
          }}
        >
          {loading && <ActivityIndicator color={colors.green} />}
          {error ? <Text style={{ color: "#c0554b", fontSize: 13 }}>{error}</Text> : null}
          {items?.map((row) => (
            <View
              key={row.id}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                  {row.userName?.trim() || "Interested buyer"}
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  Interested {timeFormatter.format(new Date(row.lastSeenAt))}
                </Text>
              </View>
              <Pressable
                onPress={() => void onMessage(row.userId, row.conversationId)}
                disabled={messagingUserId === row.userId}
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.green,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  opacity: messagingUserId === row.userId ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>
                  {messagingUserId === row.userId ? "…" : "Message"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
