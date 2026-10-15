import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from "react-native";
import type { ListingCategory, SubscriptionTier } from "@bhavano/types";
import {
  APPLE_BOOST_DAYS,
  APPLE_CREDITS_PRODUCT_ID,
  appleBoostProductId,
  appleBoostTierFor,
  appleSubscriptionsFor,
} from "@bhavano/types/appleProducts";
import { useAppTheme } from "../../theme/ThemeContext";
import { appWebUrl } from "../../lib/appWebUrl";
import { iosPurchases } from "../../lib/iosPurchasesClient";
import type { IosPurchaseRequest } from "../../lib/iosPurchases";

/** The App Store In-App Purchase sheets — iOS only (App Review Guideline 3.1.1). Android and the
 * website keep Razorpay; nothing here is mounted off iOS. Prices are Apple's own localised price
 * for each product (`displayPrice`), never the web price: on iOS the price is whatever the product
 * is set to in App Store Connect. See docs/plans/ios-in-app-purchase.md. */

export interface IosPurchaseOption {
  productId: string;
  label: string;
  request: IosPurchaseRequest;
}

const AUTO_RENEW_NOTICE =
  "Payment is charged to your Apple ID at confirmation of purchase. The subscription renews automatically at the " +
  "same price and length unless it is cancelled at least 24 hours before the end of the current period. Manage or " +
  "cancel it any time in Settings > Apple ID > Subscriptions.";

function IosPurchaseSheet({
  visible,
  title,
  blurb,
  options,
  subscription,
  emptyMessage,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  title: string;
  blurb?: string;
  options: IosPurchaseOption[];
  /** Shows the auto-renewal disclosure, Terms/Privacy links and Restore Purchases. */
  subscription?: boolean;
  /** Shown instead of the options when there is nothing to sell here. */
  emptyMessage?: string;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const { colors } = useAppTheme();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const productKey = options.map((o) => o.productId).join("|");

  useEffect(() => {
    if (!visible || options.length === 0) return;
    let cancelled = false;
    setPricesLoaded(false);
    iosPurchases
      .prices(options.map((o) => o.productId))
      .then((result) => {
        if (!cancelled) setPrices(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setPricesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // `options` is rebuilt every render; its product ids are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, productKey]);

  async function onBuy(option: IosPurchaseOption) {
    setBusy(option.productId);
    setMessage(null);
    const result = await iosPurchases.purchase(option.request);
    setBusy(null);
    if (result.outcome === "purchased") {
      onPurchased();
      onClose();
    } else if (result.outcome === "pending") {
      setMessage({ ok: true, text: "Your purchase is waiting for approval. It will be applied as soon as Apple confirms it." });
    } else if (result.outcome === "error") {
      setMessage({ ok: false, text: result.message });
    }
  }

  async function onRestore() {
    setBusy("restore");
    setMessage(null);
    const result = await iosPurchases.restore();
    setBusy(null);
    if (result.restored > 0) {
      setMessage({ ok: true, text: `Restored ${result.restored} purchase${result.restored === 1 ? "" : "s"}.` });
      onPurchased();
    } else {
      setMessage({ ok: false, text: result.message ?? "There was nothing to restore on this Apple ID." });
    }
  }

  const working = busy !== null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={working ? () => undefined : onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000066", alignItems: "center", justifyContent: "center", padding: 20 }}
        onPress={working ? undefined : onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}
        >
          <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 17, color: colors.text, marginBottom: 4 }}>{title}</Text>
          {blurb ? <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 14 }}>{blurb}</Text> : null}

          {options.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted }}>{emptyMessage ?? "Nothing is available to buy here right now."}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {options.map((option) => {
                const price = prices[option.productId];
                const unavailable = pricesLoaded && !price;
                return (
                  <Pressable
                    key={option.productId}
                    onPress={() => onBuy(option)}
                    disabled={working || !price}
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
                      opacity: working || !price ? 0.55 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text, flex: 1 }}>{option.label}</Text>
                    {busy === option.productId ? (
                      <ActivityIndicator color={colors.green} />
                    ) : (
                      <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>
                        {price ?? (unavailable ? "Unavailable" : "…")}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {message ? (
            <Text style={{ color: message.ok ? colors.green : "#c0554b", fontSize: 13, marginTop: 14 }}>{message.text}</Text>
          ) : null}

          {subscription && options.length > 0 ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <Text style={{ fontSize: 11.5, lineHeight: 16, color: colors.muted }}>{AUTO_RENEW_NOTICE}</Text>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Pressable onPress={() => Linking.openURL(appWebUrl("/terms"))}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>Terms of Use</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL(appWebUrl("/privacy"))}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>Privacy Policy</Text>
                </Pressable>
                <Pressable onPress={onRestore} disabled={working}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>
                    {busy === "restore" ? "Restoring…" : "Restore Purchases"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable onPress={onClose} disabled={working} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  buyerPremium: "Bhavano Plus",
  agentPro: "Agent/Broker Pro",
  sellerSlotPack: "Seller slot pack",
};

const TIER_BLURBS: Record<SubscriptionTier, string> = {
  buyerPremium: "Early-access saved-search alerts, a Verified Buyer badge, and priority in sellers' inboxes.",
  agentPro: "More active listings, a branded storefront, elevated video limits, and a monthly Feature credit.",
  sellerSlotPack: "More active ads at once. Slots free up when an ad expires or you remove it.",
};

function monthsLabel(months: number): string {
  if (months === 12) return "12 months, best value";
  return `${months} month${months > 1 ? "s" : ""}`;
}

export function IosSubscribeSheet({
  visible,
  tier,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  tier: SubscriptionTier;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const options: IosPurchaseOption[] = appleSubscriptionsFor(tier).map((p) => ({
    productId: p.productId,
    label: monthsLabel(p.months),
    request: { type: "subscription", productId: p.productId },
  }));
  return (
    <IosPurchaseSheet
      visible={visible}
      title={TIER_LABELS[tier]}
      blurb={TIER_BLURBS[tier]}
      options={options}
      subscription
      onClose={onClose}
      onPurchased={onPurchased}
    />
  );
}

export function IosBoostSheet({
  visible,
  listingId,
  category,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  listingId: string;
  category: ListingCategory;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const tier = appleBoostTierFor(category);
  const options: IosPurchaseOption[] = tier
    ? APPLE_BOOST_DAYS.map((days) => ({
        productId: appleBoostProductId(tier, days),
        label: `${days} days`,
        request: { type: "boost", listingId, boostDays: days },
      }))
    : [];
  return (
    <IosPurchaseSheet
      visible={visible}
      title="Feature this ad"
      blurb="Show your ad higher in search for more views. Instant Alerts are included for the length of the boost."
      options={options}
      emptyMessage="Featuring isn't available for this type of ad in the iPhone app yet."
      onClose={onClose}
      onPurchased={onPurchased}
    />
  );
}

export function IosCreditsSheet({
  visible,
  onClose,
  onPurchased,
}: {
  visible: boolean;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const options: IosPurchaseOption[] = [
    { productId: APPLE_CREDITS_PRODUCT_ID, label: "Contact reveal credits", request: { type: "credits" } },
  ];
  return (
    <IosPurchaseSheet
      visible={visible}
      title="Contact reveal credits"
      blurb="Pay as you go to see a listing's phone number and email. Credits expire after a while, as shown in your account."
      options={options}
      onClose={onClose}
      onPurchased={onPurchased}
    />
  );
}
