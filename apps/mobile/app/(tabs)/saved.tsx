import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useFavouritesQuery } from "../../src/lib/queries";
import { ListingCard } from "../../src/components/home/ListingCard";
import { GatedScreen } from "../../src/components/home/GatedScreen";

export default function SavedScreen() {
  const { colors } = useAppTheme();
  const { isLoggedIn, accessToken } = useHomeSheets();
  const { data: favourites, isLoading } = useFavouritesQuery(accessToken);

  if (!isLoggedIn) {
    return <GatedScreen title="Saved listings" />;
  }

  if (isLoading || !favourites) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      data={favourites}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard item={item} cityName={item.cityName} />}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListEmptyComponent={
        <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
          No favourites yet — tap ♡ on a listing to save it here.
        </Text>
      }
    />
  );
}
