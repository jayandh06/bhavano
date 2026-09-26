import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { RequirementDto } from "@bhavano/types";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { BffError, fetchMyRequirements } from "../src/lib/bffClient";
import { ScreenHeader } from "../src/components/home/ScreenHeader";
import { Icon } from "../src/components/Icon";
import { MyRequirementCard } from "../src/components/home/MyRequirementCard";

/**
 * Phase 1 of docs/plans/property-requirements-demand-side.md — mobile counterpart to web's
 * `/my-requirements`. Reachable from the hamburger Account block and the Account tab's
 * "View your requirements" link (same placement as desktop Profile).
 */
export default function MyRequirementsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken, isLoggedIn, requireLogin } = useHomeSheets();
  const [requirements, setRequirements] = useState<RequirementDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setRequirements(null);
      return;
    }
    setError(null);
    try {
      setRequirements(await fetchMyRequirements(accessToken));
    } catch (e) {
      if (e instanceof BffError && (e.status === 401 || e.status === 403)) {
        requireLogin();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load your requirements");
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Your requirements" onBack={() => router.back()} />

      {!isLoggedIn || !accessToken ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
            Log in to see what you&rsquo;ve asked us to look out for.
          </Text>
        </View>
      ) : requirements === null && !error ? (
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
          data={requirements ?? []}
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
          ListEmptyComponent={
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", marginBottom: 14 }}>
                Nothing here yet. When a search of yours comes up empty, you can ask us to keep looking —
                we&rsquo;ll tell you the moment something matches.
              </Text>
              <Pressable
                onPress={() => router.push("/")}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5, textAlign: "center" }}>
                  Start searching
                </Text>
                <Icon name="chevronRight" size={13} color={colors.green} />
              </Pressable>
            </View>
          }
          renderItem={({ item }) => <MyRequirementCard requirement={item} accessToken={accessToken} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  empty: { borderWidth: 1, borderRadius: 12, padding: 24, marginTop: 24 },
});
