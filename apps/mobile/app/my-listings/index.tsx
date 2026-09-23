import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { ListingDetailDto, ListingStatus } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useMyListingsQuery } from "../../src/lib/queries";
import { renewListing } from "../../src/lib/bffClient";
import { BoostButton } from "../../src/components/home/BoostButton";
import { InstantAlertsButton } from "../../src/components/home/InstantAlertsButton";
import { Icon } from "../../src/components/Icon";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import { appWebUrl } from "../../src/lib/appWebUrl";

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Active",
  sold: "Sold",
  rented: "Rented",
  deactivated: "Deactivated",
};

function statusColor(status: ListingStatus, colors: { green: string; muted: string }): string {
  return status === "active" ? colors.green : status === "deactivated" ? "#b3413a" : colors.muted;
}

/** Mirrors web's identical one-liner (apps/web/src/lib/listingExpiry.ts) — not a shared package
 * import since that file lives under apps/web, not @bhavano/types. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

const RENEW_WINDOW_DAYS = 7;

const renewedAtFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Full parity with web's /my-listings row (MyListingRow in apps/web/src/app/my-listings/
 * page.tsx): status/featured badges, Renew/Boost/View/Edit. Photo/video management stays on the
 * dedicated edit screen (app/my-listings/[id]/edit.tsx) rather than inline here too — one place
 * to manage media instead of two, unlike web's row which embeds VideoManager directly. */
export default function MyListingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { openPublishCheckout } = useLocalSearchParams<{ openPublishCheckout?: string }>();
  const { accessToken } = useHomeSheets();
  const { data: listings, isLoading, refetch, isRefetching } = useMyListingsQuery(accessToken);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewError, setRenewError] = useState<{ id: string; message: string } | null>(null);
  const autoOpenPublishRef = useRef(false);

  useEffect(() => {
    if (autoOpenPublishRef.current || !openPublishCheckout || !accessToken || !listings?.length) return;
    const pending = listings.find((l) => l.id === openPublishCheckout && l.publishState === "pending_checkout");
    if (!pending) return;
    autoOpenPublishRef.current = true;
    void WebBrowser.openBrowserAsync(appWebUrl(`/my-listings?openPublishCheckout=${pending.id}`));
    router.replace("/my-listings");
  }, [openPublishCheckout, accessToken, listings, router]);

  function openPublishCheckoutOnWeb(listingId: string) {
    void WebBrowser.openBrowserAsync(appWebUrl(`/my-listings?openPublishCheckout=${listingId}`));
  }

  async function onRenew(id: string) {
    if (!accessToken) return;
    setRenewingId(id);
    setRenewError(null);
    try {
      await renewListing(accessToken, id);
      await refetch();
    } catch (e) {
      setRenewError({ id, message: e instanceof Error ? e.message : "Failed to renew listing" });
    } finally {
      setRenewingId(null);
    }
  }

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
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: ListingDetailDto }) => {
            const daysLeft = daysUntil(item.expiresAt);
            const canRenew = item.status === "active" && daysLeft <= RENEW_WINDOW_DAYS;
            const lastRenewedAt = item.renewalHistory?.[0]?.renewedAt;
            const renewing = renewingId === item.id;
            const isPendingPublish = item.publishState === "pending_checkout";

            return (
              <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={styles.titleRow}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 }} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { borderColor: statusColor(item.status, colors) }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor(item.status, colors) }}>
                      {item.isExpired && item.status === "active" ? "Expired" : STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                  {isPendingPublish && (
                    <View style={[styles.badge, { borderColor: "#b3413a" }]}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#b3413a" }}>
                        Not live — payment pending
                      </Text>
                    </View>
                  )}
                  {item.isBoosted && (
                    <View style={[styles.badge, { borderColor: colors.gold, flexDirection: "row", alignItems: "center", gap: 3 }]}>
                      <Icon name="featured" size={11} color={colors.gold} filled />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>Featured</Text>
                    </View>
                  )}
                </View>

                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
                  {item.price} {item.priceQualifier} · {item.area}, {item.cityName}
                </Text>
                {isPendingPublish && (
                  <Text style={{ fontSize: 12.5, color: "#b3413a", marginTop: 6 }}>
                    Not visible to buyers until you complete payment on the website.
                  </Text>
                )}

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Icon name="eye" size={12} color={colors.muted} />
                    <Text style={{ fontSize: 11.5, color: colors.muted }}>{item.viewCount}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="heart" size={12} filled color={colors.muted} />
                    <Text style={{ fontSize: 11.5, color: colors.muted }}>{item.likeCount}</Text>
                  </View>
                  {canRenew && (
                    <Text style={{ fontSize: 11.5, color: colors.muted }}>
                      {item.isExpired ? "Expired" : `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                    </Text>
                  )}
                </View>
                {item.renewCount > 0 && (
                  <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }}>
                    Renewed {item.renewCount} time{item.renewCount === 1 ? "" : "s"}
                    {lastRenewedAt && ` · last on ${renewedAtFormatter.format(new Date(lastRenewedAt))}`}
                  </Text>
                )}

                <View style={styles.actionsWrapper}>
                  {/* Promotional/conditional pills — however many of these accumulate (Renew,
                      Boost, Instant Alerts, and whatever's added later), they wrap on their own
                      line and never push the two core nav icons below out of bounds. */}
                  <View style={styles.actionsRow}>
                    {isPendingPublish && (
                      <Pressable
                        onPress={() => openPublishCheckoutOnWeb(item.id)}
                        style={[styles.outlineButton, { borderColor: colors.green, backgroundColor: colors.green }]}
                      >
                        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 12.5 }}>
                          {Platform.OS === "ios" ? "Complete payment on website" : "Complete payment to publish"}
                        </Text>
                      </Pressable>
                    )}
                    {!isPendingPublish && canRenew && (
                      <Pressable
                        onPress={() => onRenew(item.id)}
                        disabled={renewing}
                        style={[styles.outlineButton, { borderColor: colors.green, opacity: renewing ? 0.6 : 1 }]}
                      >
                        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>
                          {renewing ? "Renewing…" : "Renew"}
                        </Text>
                      </Pressable>
                    )}
                    {!isPendingPublish && item.status === "active" && !item.isExpired && !item.isBoosted && accessToken && (
                      <BoostButton listingId={item.id} category={item.category} accessToken={accessToken} />
                    )}
                    {!isPendingPublish && item.status === "active" && !item.isExpired && !item.hasInstantAlerts && accessToken && (
                      <InstantAlertsButton listingId={item.id} accessToken={accessToken} />
                    )}
                  </View>
                  <View style={styles.navRow}>
                    {!isPendingPublish && (
                      <Pressable
                        onPress={() => router.push(`/listing/${item.id}`)}
                        style={[styles.iconButton, { borderColor: colors.green }]}
                      >
                        <Icon name="eye" size={15} color={colors.green} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => router.push(`/my-listings/${item.id}/edit`)}
                      style={[styles.iconButton, { backgroundColor: colors.green, borderColor: colors.green }]}
                    >
                      <Icon name="edit" size={15} color={colors.onGreen} />
                    </Pressable>
                  </View>
                </View>
                {renewError?.id === item.id && (
                  <Text style={{ color: "#c0554b", fontSize: 12, marginTop: 6 }}>{renewError.message}</Text>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
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

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  titleRow: { flexDirection: "row", alignItems: "flex-start" },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  badge: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 6, alignItems: "center" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Two rows: the top one wraps to fit however many conditional promo pills apply, the bottom
  // one is always exactly the two core nav icons — kept separate so a wide label (e.g. "Get
  // Instant Alerts") wrapping the top row can never crowd Edit/View out of the card's bounds.
  actionsWrapper: { marginTop: 12, gap: 8 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  navRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  outlineButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  iconButton: { borderWidth: 1.5, borderRadius: 8, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
