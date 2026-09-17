import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { useAppTheme } from "../../theme/ThemeContext";
import { createBoostOrder, previewBoostPricing } from "../../lib/bffClient";
import { Icon } from "../Icon";

const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

// Temporary September promo — same constant as the website's own copy in
// app/actions/payments.ts. Auto-applied so the price shown is just what checkout will actually
// charge; the discount only takes effect if this code exists, is active, and hasn't expired in
// the admin discount-codes screen — nothing here grants it on its own. Exported so the iOS
// success-screen cards in PostAdWizard.tsx (which fetch pricing for display only, no in-app
// checkout) apply the same code rather than carrying a third copy of this string.
export const SEPTEMBER_PROMO_CODE = "BHAVANO-SEP";

/**
 * Android-only inline replacement for the old separate BoostModal/InstantAlertsModal buttons on
 * the post-ad success screen — those only ever showed a price after being tapped, and treated
 * Boost and Instant Alerts as two fully independent purchases even for a seller who wanted both.
 * This fetches every combination's price up front (PaymentsService.previewBoostPricing, which
 * also resolves the current promo code and the Agent Pro free-credit case) and, when Instant
 * Alerts is added, checks out as a single combined Razorpay payment (createBoostOrder's
 * `includeInstantAlerts`) instead of two payments back to back.
 *
 * iOS keeps the old two-button, redirect-to-website treatment untouched — a native Razorpay
 * checkout for a paid feature is exactly what Apple's Guideline 3.1.1 forbids there, same
 * reasoning BoostModal/InstantAlertsModal already documented.
 */
export function BoostBundleCard({
  listingId,
  category,
  accessToken,
  onActivating,
}: {
  listingId: string;
  category: ListingCategory;
  accessToken: string;
  /** Payment succeeded (or a Pro credit activated it directly, no checkout needed) — the caller
   * swaps this card for its own "pending" state while the webhook confirms, same contract
   * BoostModal/InstantAlertsModal already use. */
  onActivating: () => void;
}) {
  const { colors } = useAppTheme();
  const [pricing, setPricing] = useState<BoostPricingPreviewDto | null>(null);
  const [duration, setDuration] = useState<BoostDurationDays>(7);
  const [addInstantAlerts, setAddInstantAlerts] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewBoostPricing(accessToken, category, SEPTEMBER_PROMO_CODE)
      .then((result) => {
        if (!cancelled) setPricing(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken, category]);

  const optionKey =
    duration === 7
      ? addInstantAlerts
        ? "boost7WithInstantAlerts"
        : "boost7"
      : addInstantAlerts
        ? "boost15WithInstantAlerts"
        : "boost15";
  const option = pricing?.[optionKey];

  async function onPay() {
    setPending(true);
    setError(null);
    try {
      const order = await createBoostOrder(accessToken, listingId, duration, SEPTEMBER_PROMO_CODE, addInstantAlerts);

      if (order.activated) {
        onActivating();
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
        description: `Boost this ad for ${duration} days${addInstantAlerts ? " + Instant Alerts" : ""}`,
      });

      onActivating();
    } catch (e) {
      // Same "no distinct cancel signal" gotcha BoostModal/InstantAlertsModal already document —
      // the native SDK reports a plain dismiss as a rejection too.
      const err = e as { code?: number; description?: string };
      const isCancel = err.description?.toLowerCase().includes("cancel");
      if (!isCancel) setError(err.description || "Payment failed — please try again.");
    } finally {
      setPending(false);
    }
  }

  function priceText(opt: BoostPricingPreviewDto["boost7"] | undefined): string {
    if (!opt) return "…";
    if (opt.free) return "Free";
    return opt.discountApplied ? `₹${opt.originalAmount} → ₹${opt.amount}` : `₹${opt.amount}`;
  }

  return (
    <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="boost" size={17} color={colors.gold} />
        <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 15, color: colors.text }}>
          Reach more buyers, faster
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {BOOST_DURATIONS.map((days) => (
          <Pressable
            key={days}
            onPress={() => setDuration(days)}
            disabled={pending}
            style={[
              styles.optionButton,
              {
                borderColor: duration === days ? colors.green : colors.border,
                backgroundColor: duration === days ? `${colors.green}1a` : colors.surface,
                opacity: pending ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: colors.text }}>Boost {days} days</Text>
            <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>
              {priceText(days === 7 ? pricing?.boost7 : pricing?.boost15)}
            </Text>
          </Pressable>
        ))}

        <View
          style={[
            styles.optionButton,
            { borderColor: colors.border, backgroundColor: colors.surface, justifyContent: "space-between" },
          ]}
        >
          <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>Add Instant Alerts</Text>
          <Switch value={addInstantAlerts} onValueChange={setAddInstantAlerts} disabled={pending} />
        </View>
      </View>

      {pending && <ActivityIndicator color={colors.green} style={{ marginTop: 14 }} />}
      {error && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 14 }}>{error}</Text>}

      <Pressable
        onPress={onPay}
        disabled={pending || !option}
        style={[styles.submitButton, { backgroundColor: colors.green, marginTop: 16, opacity: pending || !option ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>
          {option?.free ? "Activate for free" : `Pay ${priceText(option)}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 18 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
  submitButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center" },
});
