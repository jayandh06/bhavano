import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import type { ListingCategory } from "@bhavano/types";
import {
  boostPriceFor,
  DEFAULT_BOOST_PRICE_SETTINGS,
  type BoostDurationDays,
  type BoostPriceSettings,
} from "@bhavano/types/boostPricing";
import { useAppTheme } from "../../theme/ThemeContext";
import { createBoostOrder, fetchPlanPricing } from "../../lib/bffClient";
import { isRazorpayUserCancel, razorpayFailureMessage } from "../../lib/razorpayNative";

const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

/**
 * Native equivalent of the website's `BoostProvider` modal — same duration/price picker, same
 * BFF order-creation call (`POST /payments/orders`), just Razorpay's native SDK
 * (`react-native-razorpay`) opening checkout instead of the web JS SDK. The backend doesn't care
 * which client opened it: a boost activates from the Razorpay *webhook*, never from this
 * checkout call succeeding client-side — see `PaymentsService`'s own webhook handler. So
 * `onActivating` here means "payment done, webhook should catch up shortly", the same meaning it
 * has on web, not "boost is live yet".
 *
 * Needs the `react-native-razorpay` native module, so this only works in a real EAS dev-client
 * build — not Expo Go, and not the previous JS-only bundle before that dependency was added.
 */
export function BoostModal({
  visible,
  listingId,
  category,
  accessToken,
  onClose,
  onActivating,
}: {
  visible: boolean;
  listingId: string;
  category: ListingCategory;
  accessToken: string;
  onClose: () => void;
  /** Payment succeeded (or a Pro credit activated it directly, no checkout needed) — the caller
   * shows its own "Boost pending…" state while the webhook confirms. */
  onActivating: () => void;
}) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Instant first paint from the bundled defaults, swapped for the live row once it resolves —
  // see docs/plans/admin-manage-plans-pricing.md. No SSR available here (React Native), unlike
  // the website's BoostProvider, which gets this as a server-fetched prop instead.
  const [boostPriceSettings, setBoostPriceSettings] = useState<BoostPriceSettings>(DEFAULT_BOOST_PRICE_SETTINGS);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchPlanPricing()
      .then((pricing) => {
        if (!cancelled) setBoostPriceSettings(pricing.boost);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function onSelectDuration(days: BoostDurationDays) {
    setPending(true);
    setError(null);
    try {
      const order = await createBoostOrder(accessToken, listingId, days);

      // Agent Pro's monthly credit — boost applied server-side, no checkout at all.
      if (order.activated) {
        onActivating();
        onClose();
        return;
      }

      if (!order.razorpayOrderId || !order.razorpayKeyId) {
        setError("Couldn't open checkout — please try again.");
        return;
      }

      await RazorpayCheckout.open({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Bhavano",
        description: `Boost this ad for ${days} days`,
      });

      onActivating();
      onClose();
    } catch (e) {
      // Native SDK reports dismiss / mid-auth exit as a rejection — see razorpayNative.ts.
      if (!isRazorpayUserCancel(e)) setError(razorpayFailureMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={pending ? () => undefined : onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000066", alignItems: "center", justifyContent: "center", padding: 20 }}
        onPress={pending ? undefined : onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}
        >
          <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 17, color: colors.text, marginBottom: 4 }}>
            Boost this ad
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
            Featured listings rank ahead of regular ones and rotate through the top slots fairly
            — no one stays #1 forever.
          </Text>
          <View style={{ gap: 10 }}>
            {BOOST_DURATIONS.map((days) => (
              <Pressable
                key={days}
                onPress={() => onSelectDuration(days)}
                disabled={pending}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: colors.surfaceAlt,
                  opacity: pending ? 0.5 : 1,
                }}
              >
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>{days} days</Text>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>
                  ₹{boostPriceFor(category, days, boostPriceSettings)}
                </Text>
              </Pressable>
            ))}
          </View>
          {pending && <ActivityIndicator color={colors.green} style={{ marginTop: 14 }} />}
          {error && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 14 }}>{error}</Text>}
          <Pressable onPress={onClose} disabled={pending} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
