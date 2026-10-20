import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ListingCategory } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { fetchListingById } from "../../lib/bffClient";
import { startListingPublishCheckout } from "../../lib/listingPublishCheckout";
import { useMyListingsQuery } from "../../lib/queries";
import { IosBoostSheet } from "./IosPurchaseSheets";

/** Ads that were posted but never paid for, so they are held in `pending_checkout` and invisible to
 * buyers. Lives on the Plans screen so an abandoned or failed payment is recoverable from the
 * place people go to pay, on both platforms. iOS completes through the App Store boost purchase
 * (the server publishes the held ad when it verifies it); Android reruns the Razorpay publish
 * checkout. Renders nothing when there is nothing pending. */
export function PendingPayments({ accessToken }: { accessToken: string | null }) {
  const { colors } = useAppTheme();
  const { data: listings, refetch } = useMyListingsQuery(accessToken);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [iosPick, setIosPick] = useState<{ id: string; category: ListingCategory } | null>(null);

  const pending = (listings ?? []).filter((l) => l.publishState === "pending_checkout");
  if (!accessToken || pending.length === 0) return null;

  async function waitForLive(id: string, token: string): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
      if ((await fetchListingById(id, token)).publishState === "live") return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  async function onAndroidPay(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    try {
      const result = await startListingPublishCheckout({ accessToken, listingId: id, boostSelection: null });
      if (result.outcome === "cancelled") {
        setError({ id, message: "Payment was cancelled — your ad is not live yet." });
      } else if (result.outcome === "error") {
        setError({ id, message: `Payment failed — ${result.message}` });
      } else if (result.outcome === "paid" && !(await waitForLive(id, accessToken))) {
        setError({ id, message: "Payment received — still confirming publish. Check again in a moment." });
      }
    } finally {
      setBusyId(null);
      void refetch();
    }
  }

  return (
    <View style={[styles.card, { borderColor: "#b3413a", backgroundColor: colors.surface }]}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Pending payments</Text>
      <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 4 }}>
        These ads aren&apos;t visible to buyers until the payment is completed.
      </Text>
      {pending.map((item) => (
        <View key={item.id} style={[styles.row, { borderTopColor: colors.border }]}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
            {item.area}, {item.cityName}
          </Text>
          {error?.id === item.id ? (
            <Text style={{ fontSize: 12.5, color: "#c0554b", marginTop: 6 }}>{error.message}</Text>
          ) : null}
          <Pressable
            onPress={() =>
              Platform.OS === "ios" ? setIosPick({ id: item.id, category: item.category }) : void onAndroidPay(item.id)
            }
            disabled={busyId === item.id}
            style={[styles.button, { borderColor: colors.green, opacity: busyId === item.id ? 0.6 : 1 }]}
          >
            {busyId === item.id ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>
                {error?.id === item.id ? "Retry payment" : "Complete payment"}
              </Text>
            )}
          </Pressable>
        </View>
      ))}
      {Platform.OS === "ios" && iosPick && (
        <IosBoostSheet
          visible
          listingId={iosPick.id}
          category={iosPick.category}
          onClose={() => setIosPick(null)}
          onPurchased={() => {
            setIosPick(null);
            void refetch();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 12, padding: 14, marginTop: 14 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  button: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", alignSelf: "flex-start", marginTop: 10 },
});
