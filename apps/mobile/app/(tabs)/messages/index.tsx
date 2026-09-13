import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { useConversationsQuery } from "../../../src/lib/queries";
import { GatedScreen } from "../../../src/components/home/GatedScreen";
import { ScreenHeader } from "../../../src/components/home/ScreenHeader";
import { Icon } from "../../../src/components/Icon";

/** dd/mm/yyyy hh:mm:ss, in the device's local time zone — mirrors the web app's identical
 * helper on `/messages`. An explicit absolute timestamp rather than a relative "3h ago", so two
 * messages days apart are still trivially comparable. */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Nested under (tabs)/messages/_layout.tsx's own Stack (the tab's entry point, at the group's
// "index" route) rather than living directly at (tabs)/messages.tsx, so pushing to [id] keeps
// the outer Tabs bar mounted — see _layout.tsx's own comment.
export default function MessagesScreen() {
  const { colors } = useAppTheme();
  const { requireLogin, isLoggedIn, accessToken } = useHomeSheets();
  const router = useRouter();
  const { data: conversations, isLoading, refetch } = useConversationsQuery(accessToken);

  // Defensive fallback only — BottomTabBar (app/_layout.tsx) already intercepts a logged-out
  // tap before it ever navigates here, prompting login in place instead.
  //
  // Also refetches on every focus: this screen (like every tab) stays mounted once visited, so
  // without this a conversation fetched once early in the app session — before, say, a listing's
  // area/city got backfilled, or simply before this row existed — would keep showing that first
  // response indefinitely instead of picking up what the BFF returns now.
  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
      else void refetch();
    }, [isLoggedIn, requireLogin, refetch]),
  );

  if (!isLoggedIn || !accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Messages" />
        <GatedScreen title="Messages" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Messages" />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={conversations ?? []}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
              No conversations yet.
            </Text>
          }
          renderItem={({ item }) => {
            const hasUnread = item.unreadCount > 0;
            return (
              <Pressable
                onPress={() => router.push(`/messages/${item.id}`)}
                style={[styles.row, { borderColor: colors.border }]}
              >
                {/* Filled/green once there's anything unread, outline/muted once fully read —
                    a glance at the icon says which, without needing the count badge too. */}
                <View style={[styles.iconCircle, { backgroundColor: hasUnread ? colors.green : colors.surfaceAlt }]}>
                  <Icon name="message" size={16} filled={hasUnread} color={hasUnread ? colors.onGreen : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  {/* The other participant's name/phone never renders here — this app makes its
                      money on a *paid* contact reveal, so a free-to-read messages list can't be
                      the place that hands out who someone is. The listing is what the thread is
                      about either way. */}
                  <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }} numberOfLines={1}>
                    {item.listingTitle}
                  </Text>
                  {/* Where and when, on one line — mirrors the web app's identical row. */}
                  <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {item.listingArea}, {item.listingCityName}
                    {item.lastMessage ? ` · ${formatMessageTime(item.lastMessage.createdAt)}` : ""}
                  </Text>
                  {item.lastMessage && (
                    <Text style={{ fontSize: 13, color: colors.textSoft, marginTop: 4 }} numberOfLines={1}>
                      {item.lastMessage.body}
                    </Text>
                  )}
                </View>
                {hasUnread && (
                  <View style={[styles.badge, { backgroundColor: colors.green }]}>
                    <Text style={{ color: colors.onGreen, fontSize: 11, fontWeight: "700" }}>{item.unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 14 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  badge: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 3 },
});
