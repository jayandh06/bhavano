import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useConversationsQuery } from "../../src/lib/queries";
import { GatedScreen } from "../../src/components/home/GatedScreen";
import { Icon } from "../../src/components/Icon";

// Moved here from the old top-level app/messages/index.tsx to become a bottom tab (replacing
// Saved) — dropped the `<Stack.Screen headerShown>` override that screen needed as a pushed
// route, since tabs draw their own in-body heading instead, matching Home/Account.
export default function MessagesScreen() {
  const { colors } = useAppTheme();
  const { requireLogin, isLoggedIn, accessToken } = useHomeSheets();
  const router = useRouter();
  const { data: conversations, isLoading } = useConversationsQuery(accessToken);

  // Defensive fallback only — the tab bar itself (see (tabs)/_layout.tsx's `listeners`) already
  // intercepts a logged-out tap before it ever navigates here, prompting login in place instead.
  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
    }, [isLoggedIn, requireLogin]),
  );

  if (!isLoggedIn || !accessToken) {
    return <GatedScreen title="Messages" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", padding: 16, paddingBottom: 4 }}>
        Messages
      </Text>

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
