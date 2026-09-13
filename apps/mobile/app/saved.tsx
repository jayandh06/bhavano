import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useFavouritesQuery } from "../src/lib/queries";
import { ListingCard } from "../src/components/home/ListingCard";

// Moved out of the bottom tab bar (was `(tabs)/saved.tsx`) in favour of a Messages tab — reachable
// now from the Account tab's "Saved listings" row instead, same pattern as Purchase history.
export default function SavedScreen() {
  const { colors } = useAppTheme();
  const { accessToken } = useHomeSheets();
  const { data: favourites, isLoading } = useFavouritesQuery(accessToken);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Saved listings", headerShown: true }} />

      {isLoading || !favourites ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
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
