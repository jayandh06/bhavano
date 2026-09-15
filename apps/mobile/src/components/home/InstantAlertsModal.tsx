import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import { DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS, type InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import { useAppTheme } from "../../theme/ThemeContext";
import { createInstantAlertsOrder, fetchPlanPricing } from "../../lib/bffClient";

/**
 * Native equivalent of the website's `InstantAlertsProvider` modal — flat fee, no duration
 * picker (unlike BoostModal), same single-confirm shape as the credits-purchase flow. Same BFF
 * order-creation call (`POST /payments/instant-alerts`), Razorpay's native SDK instead of the
 * web JS SDK. Activates from the webhook, not this checkout call succeeding — see
 * PaymentsService's own webhook handler — so `onActivating` here means "payment done, webhook
 * should catch up shortly", not "Instant Alerts is live yet".
 *
 * Needs the `react-native-razorpay` native module — same EAS dev-client requirement as BoostModal.
 */
export function InstantAlertsModal({
  visible,
  listingId,
  accessToken,
  onClose,
  onActivating,
}: {
  visible: boolean;
  listingId: string;
  accessToken: string;
  onClose: () => void;
  /** Payment succeeded — the caller shows its own "Instant Alerts pending…" state while the
   * webhook confirms. */
  onActivating: () => void;
}) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Instant first paint from the bundled default, swapped for the live row once it resolves —
  // same reasoning as BoostModal's identical pattern.
  const [priceSettings, setPriceSettings] = useState<InstantAlertsPriceSettings>(
    DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS,
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchPlanPricing()
      .then((pricing) => {
        if (!cancelled) setPriceSettings(pricing.instantAlerts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function onConfirm() {
    setPending(true);
    setError(null);
    try {
      const order = await createInstantAlertsOrder(accessToken, listingId);

      await RazorpayCheckout.open({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Bhavano",
        description: "Instant Alerts for this ad",
      });

      onActivating();
      onClose();
    } catch (e) {
      // Same "no distinct cancel signal" caveat as BoostModal's identical catch block.
      const err = e as { code?: number; description?: string };
      const isCancel = err.description?.toLowerCase().includes("cancel");
      if (!isCancel) setError(err.description || "Payment failed — please try again.");
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
            Get Instant Alerts
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
            We&apos;ll email you (or WhatsApp you) the moment a buyer messages you about this ad — no need to keep
            checking the app. Valid until this ad expires.
          </Text>
          <Pressable
            onPress={onConfirm}
            disabled={pending}
            style={{
              backgroundColor: colors.green,
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
              opacity: pending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 14, color: colors.onGreen }}>
              Get Instant Alerts — ₹{priceSettings.instantAlertsPrice}
            </Text>
          </Pressable>
          <View style={{ marginTop: 14, alignItems: "center" }}>
            {pending && <ActivityIndicator color={colors.green} />}
            {error && <Text style={{ color: "#c0554b", fontSize: 13 }}>{error}</Text>}
          </View>
          <Pressable onPress={onClose} disabled={pending} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
