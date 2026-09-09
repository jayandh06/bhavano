import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import type { PaymentHistoryItemDto, PaymentPurpose, PaymentStatus } from "@bhavano/types";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useInfinitePaymentHistoryQuery } from "../src/lib/queries";

const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  listing_boost: "Listing boost",
  buyer_premium: "Bhavano Plus",
  agent_pro: "Agent/Broker Pro",
  seller_slot_pack: "Seller slot pack",
  contact_reveal_credits: "Contact reveal credits",
};

// Hex, not a theme color key — the theme has no "danger"/red entry (see ListingCard.tsx's own
// error text, which hardcodes the same shade for the same reason).
function statusColor(status: PaymentStatus, colors: { green: string; muted: string }): string {
  if (status === "paid") return colors.green;
  if (status === "failed") return "#c0554b";
  return colors.muted;
}

// Mirrors apps/web/src/app/purchases/page.tsx's detailFor — same reasoning: PaymentHistoryItemDto
// only carries listingId/listingTitle, not enough to build a real listing route, so this is text
// only, never a link.
function detailFor(item: PaymentHistoryItemDto): string {
  switch (item.purpose) {
    case "listing_boost":
      return item.listingTitle ? `${item.boostDays ?? "?"}-day boost — ${item.listingTitle}` : `${item.boostDays ?? "?"}-day boost`;
    case "buyer_premium":
    case "seller_slot_pack":
      return `${item.subscriptionMonths ?? "?"} month${item.subscriptionMonths === 1 ? "" : "s"}`;
    case "agent_pro":
      return `${item.subscriptionMonths ?? "?"} month${item.subscriptionMonths === 1 ? "" : "s"}${item.agentProUnits ? ` · ${item.agentProUnits} unit${item.agentProUnits === 1 ? "" : "s"}` : ""}`;
    case "contact_reveal_credits":
      return `${item.creditPackSize ?? "?"} credits`;
    default:
      return "—";
  }
}

export default function PurchasesScreen() {
  const { colors } = useAppTheme();
  const { accessToken } = useHomeSheets();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfinitePaymentHistoryQuery(accessToken);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Purchase history", headerShown: true }} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={items}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>
              No purchases yet.
            </Text>
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} /> : null}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>{PURPOSE_LABELS[item.purpose]}</Text>
                <Text style={{ fontSize: 12.5, color: colors.textSoft }}>{detailFor(item)}</Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>₹{item.amount / 100}</Text>
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: statusColor(item.status, colors) }}>
                  {item.status}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
});
