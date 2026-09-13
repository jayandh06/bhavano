import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useConversationsQuery } from "../../src/lib/queries";
import { GatedScreen } from "../../src/components/home/GatedScreen";

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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/messages/${item.id}`)}
              style={[styles.row, { borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>{item.otherPartyName}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{item.listingTitle}</Text>
                {item.lastMessage && (
                  <Text style={{ fontSize: 13, color: colors.textSoft, marginTop: 4 }} numberOfLines={1}>
                    {item.lastMessage.body}
                  </Text>
                )}
              </View>
              {item.unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.green }]}>
                  <Text style={{ color: colors.onGreen, fontSize: 11, fontWeight: "700" }}>{item.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 14 },
  badge: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 3 },
});
