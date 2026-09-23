import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useFavouritesQuery } from "../src/lib/queries";
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

      {isLoading || !favourites ? (
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
