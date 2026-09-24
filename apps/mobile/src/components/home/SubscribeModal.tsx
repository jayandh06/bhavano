import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import type { SubscriptionTier } from "@bhavano/types";
import { subscriptionPriceFor, type SubscriptionPlanSettings } from "@bhavano/types/subscriptionPricing";
import { useAppTheme } from "../../theme/ThemeContext";
import { createSubscriptionOrder } from "../../lib/bffClient";
import { isRazorpayUserCancel, razorpayFailureMessage } from "../../lib/razorpayNative";

/** Same per-tier durations the website's SubscribeButton offers — only Bhavano Plus has terms
 * longer than a month. */
const DURATIONS_BY_TIER: Record<SubscriptionTier, number[]> = {
  buyerPremium: [1, 6, 12],
  agentPro: [1],
  sellerSlotPack: [1],
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  buyerPremium: "Bhavano Plus",
  agentPro: "Agent/Broker Pro",
  sellerSlotPack: "Seller slot pack",
};

const TIER_BLURBS: Record<SubscriptionTier, string> = {
  buyerPremium: "Early-access saved-search alerts, a Verified Buyer badge, and priority in sellers' inboxes.",
  agentPro: "More active listings, a branded storefront, elevated video limits, and a monthly boost credit.",
  sellerSlotPack: "More active ads at once. Slots free up when an ad expires or you remove it.",
};

function durationLabel(tier: SubscriptionTier, months: number, settings: SubscriptionPlanSettings): string {
  if (tier === "buyerPremium") {
    if (months === 12) return "12 months — best value";
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  if (tier === "sellerSlotPack") return `${settings.sellerSlotPackTotalSlots} active listings — 1 month`;
  return `1 month — ${settings.proListingSlotsPerUnit} listings`;
}

/**
 * Native equivalent of the website's `SubscribeButton` — same duration/price picker, same BFF
 * order-creation call (`POST /payments/subscriptions`), Razorpay's native SDK opening checkout.
 * Like boosts, the subscription activates from the Razorpay *webhook*, never from this checkout
 * call returning — so `onActivating` means "payment done, webhook should catch up shortly".
 *
 * **Android only.** Selling a subscription inside the iOS app through Razorpay is exactly what
 * App Store Guideline 3.1.1 forbids, even more plainly than a listing boost — `plans.tsx` sends
 * iOS to the website instead and never mounts this. See docs/plans/ios-app-store-release.md.
 */
export function SubscribeModal({
  visible,
  tier,
  accessToken,
  planPricing,
  onClose,
  onActivating,
}: {
  visible: boolean;
  tier: SubscriptionTier;
  accessToken: string;
  planPricing: SubscriptionPlanSettings;
  onClose: () => void;
  onActivating: () => void;
}) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelectDuration(months: number) {
    setPending(true);
    setError(null);
    try {
      const order = await createSubscriptionOrder(accessToken, tier, months);

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
        description: `${TIER_LABELS[tier]} — ${months} month${months > 1 ? "s" : ""}`,
      });

      onActivating();
      onClose();
    } catch (e) {
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
            {TIER_LABELS[tier]}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>{TIER_BLURBS[tier]}</Text>
          <View style={{ gap: 10 }}>
            {DURATIONS_BY_TIER[tier].map((months) => (
              <Pressable
                key={months}
                onPress={() => onSelectDuration(months)}
                disabled={pending}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: colors.surfaceAlt,
                  opacity: pending ? 0.5 : 1,
                }}
              >
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text, flex: 1 }}>
                  {durationLabel(tier, months, planPricing)}
                </Text>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>
                  ₹{subscriptionPriceFor(tier, months, 1, planPricing)}
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
