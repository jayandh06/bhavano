import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useFavouritesQuery } from "../src/lib/queries";
import { useGuestSaves } from "../src/lib/guestSaves";
import { ListingCard } from "../src/components/home/ListingCard";
import { ScreenHeader } from "../src/components/home/ScreenHeader";

// Moved out of the bottom tab bar (was `(tabs)/saved.tsx`) in favour of a Messages tab — reachable
// now from the Account tab's "Saved listings" row instead, same pattern as Purchase history.
export default function SavedScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken } = useHomeSheets();
  const { data: favourites, isLoading, refetch, isRefetching } = useFavouritesQuery(accessToken);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Saved listings" onBack={() => router.back()} />

      {!accessToken ? (
        <GuestSavedList />
      ) : isLoading || !favourites ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          refreshControl={<RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            // tintColor is iOS-only and `colors` is the Android equivalent — set both, or the
            // Android spinner falls back to its stock blue. progressBackgroundColor keeps the
            // circle it sits in from staying light against a dark theme.
            tintColor={colors.green}
            colors={[colors.green]}
            progressBackgroundColor={colors.surface}
          />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          data={favourites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
              No favourites yet — tap the heart on a listing to save it here.
            </Text>
          }
        />
      )}
    </View>
  );
}

/** Logged out: the homes saved on this phone, with a login that moves them to the account. */
function GuestSavedList() {
  const { colors } = useAppTheme();
  const { requireLogin } = useHomeSheets();
  const saves = useGuestSaves();

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={saves}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListHeaderComponent={
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            marginBottom: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 }}>
            {saves.length
              ? "Saved on this phone only. Log in to keep them on any phone."
              : "Log in to see your saved homes, or tap the heart on a listing to save it here."}
          </Text>
          <Pressable
            onPress={() => requireLogin()}
            style={{ backgroundColor: colors.green, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>Log in</Text>
          </Pressable>
        </View>
      }
    />
  );
}
