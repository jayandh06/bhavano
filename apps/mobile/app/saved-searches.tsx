import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { SavedSearchAllowanceDto, SavedSearchDto } from "@bhavano/types";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import {
  BffError,
  deleteSavedSearch,
  fetchSavedSearchAllowance,
  fetchSavedSearches,
} from "../src/lib/bffClient";
import { ScreenHeader } from "../src/components/home/ScreenHeader";
import { Icon } from "../src/components/Icon";
import { useMarket } from "../src/lib/market";
import type { MarketId } from "@bhavano/types/market";
import { bedroomListText, savedSearchMoney } from "../src/lib/marketText";
import { Trellis } from "../src/components/Trellis";

function criteriaLine(s: SavedSearchDto, id: MarketId): string {
  const parts: string[] = [];
  if (s.areaNames.length) parts.push(s.areaNames.join(", "));
  else if (s.cityName) parts.push(`All of ${s.cityName}`);
  if (s.bedroomOptions.length) parts.push(bedroomListText(s.bedroomOptions, ", ", id));
  if (s.minPrice !== undefined || s.maxPrice !== undefined) {
    parts.push(`${s.minPrice !== undefined ? savedSearchMoney(s.minPrice, id) : "Any"} – ${s.maxPrice !== undefined ? savedSearchMoney(s.maxPrice, id) : "Any"}`);
  }
  return parts.join(" · ");
}

/**
 * Mobile counterpart to the website's `/saved-searches`: the alerts you've saved, with delete.
 * New ones are created from the home screen's "Save this search" button (city and a price range
 * set), the same way the website's browse page does it. Reachable from the Account tab.
 */
export default function SavedSearchesScreen() {
  const { colors } = useAppTheme();
  const market = useMarket();
  const router = useRouter();
  const { accessToken, isLoggedIn, requireLogin } = useHomeSheets();
  const [searches, setSearches] = useState<SavedSearchDto[] | null>(null);
  const [allowance, setAllowance] = useState<SavedSearchAllowanceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setSearches(null);
      return;
    }
    setError(null);
    try {
      const [list, allow] = await Promise.all([fetchSavedSearches(accessToken), fetchSavedSearchAllowance(accessToken)]);
      setSearches(list);
      setAllowance(allow);
    } catch (e) {
      if (e instanceof BffError && (e.status === 401 || e.status === 403)) {
        requireLogin();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load your saved searches");
    }
  }, [accessToken, requireLogin]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) {
        requireLogin();
        return;
      }
      void load();
    }, [isLoggedIn, requireLogin, load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  function confirmDelete(s: SavedSearchDto) {
    Alert.alert("Delete saved search?", `You'll stop getting alerts for “${s.name}”.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (!accessToken) return;
          setDeletingId(s.id);
          deleteSavedSearch(accessToken, s.id)
            .then(() => load())
            .catch((e) => Alert.alert("Couldn't delete", e instanceof Error ? e.message : "Please try again."))
            .finally(() => setDeletingId(null));
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Trellis surface="body" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Saved searches" onBack={() => router.back()} />

      {!isLoggedIn || !accessToken ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
            Log in to manage your saved searches.
          </Text>
        </View>
      ) : searches === null && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: "#c0554b", fontSize: 14, textAlign: "center", marginBottom: 12 }}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
          data={searches ?? []}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.green}
              colors={[colors.green]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                Get notified the moment a new listing matches — before you&rsquo;d ever spot it browsing. Save one
                from the home screen: pick a tab, set an area and a price range, then tap Save this search.
              </Text>
              {allowance && !allowance.canCreate && (
                <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: 12 }]}>
                  <Text style={{ color: colors.text, fontSize: 13.5, lineHeight: 19 }}>
                    You&rsquo;ve used your free saved search alerts.{market.paymentsEnabled ? " Subscribe to Bhavano Plus for unlimited alerts." : ""}
                  </Text>
                  {market.paymentsEnabled && (
                    <Pressable onPress={() => router.push("/plans")} style={{ marginTop: 10 }}>
                      <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>Get Bhavano Plus →</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {allowance?.canCreate && allowance.source === "free" && (
                <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8 }}>
                  {allowance.freeRemaining} free {allowance.freeRemaining === 1 ? "alert" : "alerts"} left.
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", marginBottom: 14 }}>
                No saved searches yet.
              </Text>
              <Pressable
                onPress={() => router.push("/")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>Start searching</Text>
                <Icon name="chevronRight" size={13} color={colors.green} />
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                    {criteriaLine(item, market.id) || "Any listing"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  disabled={deletingId === item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete saved search ${item.name}`}
                  hitSlop={8}
                >
                  <Text style={{ color: "#c0554b", fontWeight: "700", fontSize: 13, opacity: deletingId === item.id ? 0.5 : 1 }}>
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
});
