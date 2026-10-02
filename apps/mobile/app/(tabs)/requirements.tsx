import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import type { SellerType } from "@bhavano/types";
import {
  encodeRequirementFeedQuery,
  type RequirementFeedFilters,
  type RequirementFeedSummaryDto,
} from "@bhavano/types/requirementFeed";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useRequirementsFeedQuery, useRequirementsFeedSummaryQuery } from "../../src/lib/queries";
import { friendlyErrorMessage, updateProfile } from "../../src/lib/bffClient";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import { RequirementsFeedFilters } from "../../src/components/home/RequirementsFeedFilters";
import { RequirementFeedCard } from "../../src/components/home/RequirementFeedCard";

/**
 * Mobile counterpart to web's `/requirements` (RequirementsFeedPage.tsx) — what buyers and
 * tenants are looking for, for owners and agents with something that fits. The owner/agent-only
 * 5th tab from docs/plans/requirements-feed-for-owners-agents.md: BottomTabBar only lists it once
 * `useHomeSheets().profile` looks like an owner or agent (see its own eligibility heuristic),
 * so before that this screen is reached only via the Account screen's "View requirements" row —
 * which is also why `onBack` is conditional, same as `(tabs)/account.tsx`'s identical pattern:
 * sometimes this is a tab root (nothing to go back to), sometimes a pushed screen from that row.
 *
 * Defaults to the app's own currently-selected city (`useHomeSheets().city`) but keeps its own
 * local override from there on — same independence web's city Filter chips have from the rest of
 * the site's city, which this screen's Filters sheet mirrors (see RequirementsFeedFilters.tsx).
 */
export default function RequirementsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, isLoggedIn, requireLogin, city: homeCity } = useHomeSheets();
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const onBack = router.canGoBack() ? () => router.back() : undefined;

  const [filters, setFilters] = useState<RequirementFeedFilters>(() => ({ city: homeCity?.id }));
  const [cityName, setCityName] = useState<string | undefined>(homeCity?.name);
  const [refreshing, setRefreshing] = useState(false);
  const [roleSaving, setRoleSaving] = useState<SellerType | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const feedQuery = useRequirementsFeedQuery(filters, isLoggedIn ? accessToken : null);
  const feed = feedQuery.data;
  const needsSummary = !isLoggedIn || (feed !== undefined && feed.eligible === false);
  const summaryQuery = useRequirementsFeedSummaryQuery(filters.city, needsSummary);

  const activeFilterCount = Object.keys(encodeRequirementFeedQuery({ ...filters, city: undefined }, false)).length;

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([feedQuery.refetch(), summaryQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  function applyFilters(next: RequirementFeedFilters) {
    // The sheet picks city by id only — keep a matching display name from whichever chip's
    // label the sheet just showed, so the header never has to re-derive it from a lookup.
    if (next.city !== filters.city) {
      setCityName(next.city ? feed?.facets.cities.find((c) => c.cityId === next.city)?.cityName : undefined);
    }
    setFilters(next);
    filterSheetRef.current?.dismiss();
  }

  async function chooseRole(sellerType: SellerType) {
    if (!accessToken) return;
    setRoleSaving(sellerType);
    setRoleError(null);
    try {
      await updateProfile(accessToken, { sellerType });
      await queryClient.invalidateQueries({ queryKey: ["requirementsFeed"] });
    } catch (e) {
      setRoleError(friendlyErrorMessage(e, "That didn't save. Please try again."));
    } finally {
      setRoleSaving(null);
    }
  }

  const title = cityName ? `Requirements in ${cityName}` : "Requirements";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={title} onBack={onBack} />

      {!isLoggedIn ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.green} />}
        >
          <SummaryBlock summary={summaryQuery.data} />
          <View style={[styles.gatePanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 13.5, color: colors.text, textAlign: "center", marginBottom: 14 }}>
              Own property or work as an agent? Log in to see what people are looking for.
            </Text>
            <Pressable onPress={() => requireLogin()} style={[styles.primaryButton, { backgroundColor: colors.green }]}>
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : feedQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : feedQuery.isError ? (
        <View style={styles.centered}>
          <Text style={{ color: "#c0554b", fontSize: 14, textAlign: "center", marginBottom: 12 }}>
            {friendlyErrorMessage(feedQuery.error, "Couldn't load requirements")}
          </Text>
          <Pressable onPress={() => void feedQuery.refetch()}>
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>Try again</Text>
          </Pressable>
        </View>
      ) : feed && !feed.eligible ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.green} />}
        >
          <View style={[styles.gatePanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: colors.text, marginBottom: 2 }}>
              Requirements are for owners and agents
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 14 }}>Which describes you?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                disabled={roleSaving !== null}
                onPress={() => void chooseRole("owner")}
                style={[styles.roleButton, { backgroundColor: colors.green, opacity: roleSaving !== null ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5 }}>
                  {roleSaving === "owner" ? "Saving…" : "I own property"}
                </Text>
              </Pressable>
              <Pressable
                disabled={roleSaving !== null}
                onPress={() => void chooseRole("agent")}
                style={[styles.roleButton, { backgroundColor: colors.green, opacity: roleSaving !== null ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5 }}>
                  {roleSaving === "agent" ? "Saving…" : "I'm an agent"}
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push("/my-requirements")} style={[styles.roleButton, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 13.5 }}>I&rsquo;m looking for property</Text>
              </Pressable>
            </View>
            {roleError && <Text style={{ color: "#c0554b", fontSize: 12.5, marginTop: 10 }}>{roleError}</Text>}
          </View>
          <SummaryBlock summary={summaryQuery.data} />
        </ScrollView>
      ) : feed ? (
        <>
          <View style={styles.toolbarRow}>
            <Pressable
              onPress={() => filterSheetRef.current?.present()}
              style={[styles.pillButton, { backgroundColor: colors.surfaceAlt, borderColor: activeFilterCount > 0 ? colors.green : colors.border }]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: activeFilterCount > 0 ? colors.green : colors.text }}>Filters</Text>
              {activeFilterCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.green }]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.onGreen }}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => setFilters((p) => ({ ...p, sort: p.sort === "soonest" ? undefined : "soonest" }))}
              style={[styles.pillButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                Sort: {filters.sort === "soonest" ? "Moving in soonest" : "Newest"}
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={feed.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: 40, flexGrow: 1 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.green} />}
            ListHeaderComponent={
              <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 10 }}>
                {feed.total === 0
                  ? "No requirements match"
                  : feed.items.length < feed.total
                    ? `Showing ${feed.items.length} of ${feed.total}`
                    : `${feed.total} requirement${feed.total === 1 ? "" : "s"}`}
              </Text>
            }
            ListEmptyComponent={
              <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center" }}>
                  {cityName
                    ? `Nothing matches in ${cityName} right now. New requirements come in every day, so check back, or widen the filters.`
                    : "Nothing matches right now. New requirements come in every day, so check back, or widen the filters."}
                </Text>
              </View>
            }
            renderItem={({ item }) => <RequirementFeedCard card={item} />}
          />

          <RequirementsFeedFilters
            ref={filterSheetRef}
            applied={filters}
            facets={feed.facets}
            hasListings={feed.hasListings}
            onApply={applyFilters}
          />
        </>
      ) : null}
    </View>
  );
}

function SummaryBlock({ summary }: { summary: RequirementFeedSummaryDto | undefined }) {
  const { colors } = useAppTheme();
  if (!summary || summary.total === 0) return null;
  return (
    <View style={[styles.summaryPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 10 }}>
        {summary.total} open requirement{summary.total === 1 ? "" : "s"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {summary.cities.map((c) => (
          <Text key={c.cityId} style={{ fontSize: 13, color: colors.green }}>
            {c.cityName} ({c.count})
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  gatePanel: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 16 },
  summaryPanel: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  primaryButton: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  roleButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
  empty: { borderWidth: 1, borderRadius: 12, padding: 24, marginTop: 8, alignItems: "center" },
  toolbarRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  badge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
