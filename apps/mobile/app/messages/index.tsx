import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useConversationsQuery } from "../../src/lib/queries";

export default function MessagesListScreen() {
  const { colors } = useAppTheme();
  const { accessToken } = useHomeSheets();
  const router = useRouter();
  const { data: conversations, isLoading } = useConversationsQuery(accessToken);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Messages", headerShown: true }} />

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
