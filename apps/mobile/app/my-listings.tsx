import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useMyListingsQuery } from "../src/lib/queries";
import { ListingCard } from "../src/components/home/ListingCard";
import { ScreenHeader } from "../src/components/home/ScreenHeader";

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Active",
  sold: "Sold",
  rented: "Rented",
  deactivated: "Deactivated",
};

function statusColor(status: ListingStatus, colors: { green: string; muted: string }): string {
  return status === "active" ? colors.green : colors.muted;
}

// Read-only for now — editing (price/title/specs/status, boost, renew) stays on the website's
// /my-listings until PostAdWizard is wired for edit mode, which is real feature work of its own
// rather than something this pass builds. ListingCard already hides Message/View Contact for a
// listing the viewer owns (isOwner), so nothing extra is needed there.
export default function MyListingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken } = useHomeSheets();
  const { data: listings, isLoading } = useMyListingsQuery(accessToken);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="My listings" onBack={() => router.back()} />

      {isLoading || !listings ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: ListingDetailDto }) => (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor(item.status, colors) }} />
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: statusColor(item.status, colors) }}>
                  {STATUS_LABELS[item.status]}
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  · {item.viewCount} view{item.viewCount === 1 ? "" : "s"} · {item.likeCount} favourite
                  {item.likeCount === 1 ? "" : "s"}
                </Text>
              </View>
              <ListingCard item={item} />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
              You haven&rsquo;t posted any ads yet.
            </Text>
          }
        />
      )}
    </View>
  );
}
