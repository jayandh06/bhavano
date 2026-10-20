import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { SubscriptionTier } from "@bhavano/types";
import {
  DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
  subscriptionPriceFor,
  type SubscriptionPlanSettings,
} from "@bhavano/types/subscriptionPricing";
import { useAppTheme } from "../src/theme/ThemeContext";
import { useHomeSheets } from "../src/context/HomeSheetsProvider";
import { fetchPlanPricing } from "../src/lib/bffClient";
import { Icon, type IconName } from "../src/components/Icon";
import { ScreenHeader } from "../src/components/home/ScreenHeader";
import { SubscribeModal } from "../src/components/home/SubscribeModal";
import { PendingPayments } from "../src/components/home/PendingPayments";
import { IosSubscribeSheet } from "../src/components/home/IosPurchaseSheets";
import { appleSubscriptionsFor } from "@bhavano/types/appleProducts";
import { iosPurchases } from "../src/lib/iosPurchasesClient";

interface PlanCard {
  tier: SubscriptionTier;
  icon: IconName;
  title: string;
  audience: string;
  /** `ios` hides web prices: an iOS card shows the App Store's price, never the web one. */
  features: (settings: SubscriptionPlanSettings, ios: boolean) => string[];
}

const PLAN_CARDS: PlanCard[] = [
  {
    tier: "buyerPremium",
    icon: "featured",
    title: "Bhavano Plus",
    audience: "For buyers & renters",
    features: () => [
      "Early-access saved-search alerts when a matching listing posts",
      "A “Verified Buyer” badge on messages you send",
      "Priority visibility in sellers’ inboxes",
    ],
  },
  {
    tier: "sellerSlotPack",
    icon: "pack",
    title: "Seller slot pack",
    audience: "For individual sellers",
    features: (s) => [
      `${s.sellerSlotPackTotalSlots} active listings at once (${s.freeListingSlots} free + ${s.sellerSlotPackTotalSlots - s.freeListingSlots} extra)`,
      "Slots free up when an ad expires or you remove it",
    ],
  },
  {
    tier: "agentPro",
    icon: "building",
    title: "Agent/Broker Pro",
    audience: "For agents & brokers",
    features: (s, ios) => [
      ios ? `${s.proListingSlotsPerUnit} active listings` : `${s.proListingSlotsPerUnit} active listings per ₹${s.agentProMonthlyPricePerUnit}/month`,
      "Public storefront with a Bhavano Pro badge",
      "Elevated video limits when posting",
      "One 7-day boost credit every month",
    ],
  },
];

/**
 * Native plans screen — the compare-and-subscribe surface that used to be a browser hand-off to
 * the website's `/premium` (HomeDrawer/UtilityBar's "Plans" links).
 *
 * Comparison and purchase live together here, same as the website's reworked `/premium`: each
 * tier's card carries its own price and feature list, and its CTA. Stacked cards rather than a
 * side-by-side table — a 4-column table doesn't read on a phone, and the cards are what the
 * website's own comparison CTAs jump down to anyway.
 *
 * The CTA is platform-split, exactly like the listing-boost flow: Android opens the native
 * Razorpay checkout (`SubscribeModal`); iOS sells the same plans through the App Store
 * (`IosSubscribeSheet`), because selling a subscription through a third-party processor, or
 * pointing at the website to buy one, is what App Store Guideline 3.1.1 forbids. iOS shows the
 * App Store's own price for each plan (never the web price) and never mounts the Razorpay modal.
 * See docs/plans/ios-in-app-purchase.md.
 */
export default function PlansScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken, profile, requireLogin, refreshProfile } = useHomeSheets();
  // Bundled defaults first so prices render immediately, swapped for the admin-configured row
  // once it lands — same pattern as BoostModal (see docs/plans/admin-manage-plans-pricing.md).
  const [planPricing, setPlanPricing] = useState<SubscriptionPlanSettings>(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS);
  const [subscribeTier, setSubscribeTier] = useState<SubscriptionTier | null>(null);
  const [activating, setActivating] = useState<SubscriptionTier | null>(null);
  const [iosTier, setIosTier] = useState<SubscriptionTier | null>(null);
  const [iosPrices, setIosPrices] = useState<Record<string, string>>({});
  const ios = Platform.OS === "ios";

  useEffect(() => {
    let cancelled = false;
    fetchPlanPricing()
      .then((pricing) => {
        if (!cancelled) setPlanPricing(pricing.subscription);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The App Store's own localised price for each plan's shortest term, shown on the cards.
  useEffect(() => {
    if (!ios) return;
    let cancelled = false;
    const productIds = PLAN_CARDS.map((plan) => appleSubscriptionsFor(plan.tier)[0].productId);
    iosPurchases
      .prices(productIds)
      .then((prices) => {
        if (!cancelled) setIosPrices(prices);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ios]);

  const now = Date.now();
  function activeUntil(tier: SubscriptionTier): Date | null {
    const raw =
      tier === "buyerPremium"
        ? profile?.premiumUntil
        : tier === "sellerSlotPack"
          ? profile?.sellerSlotPackUntil
          : profile?.agentProUntil;
    if (!raw) return null;
    const date = new Date(raw);
    return date.getTime() > now ? date : null;
  }

  function onSubscribe(tier: SubscriptionTier) {
    if (ios) {
      // See this screen's own doc comment — Guideline 3.1.1.
      if (!accessToken) requireLogin({ onSuccess: () => setIosTier(tier) });
      else setIosTier(tier);
      return;
    }
    if (!accessToken) {
      requireLogin({ onSuccess: () => setSubscribeTier(tier) });
      return;
    }
    setSubscribeTier(tier);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Plans & upgrades" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Compare what each plan includes, then pick one — all on this screen.
        </Text>

        <PendingPayments accessToken={accessToken} />

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.cardTitleRow}>
            <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.text }}>
              Free seller
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.green }}>₹0</Text>
          </View>
          <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
            {planPricing.freeListingSlots} active listings — included on every account.
          </Text>
          <Pressable
            onPress={() => router.push("/post")}
            style={[styles.outlineCta, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          >
            <View style={styles.ctaRow}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>Post an ad</Text>
              <Icon name="chevronRight" size={13} color={colors.green} />
            </View>
          </Pressable>
        </View>

        {PLAN_CARDS.map((plan) => {
          const until = activeUntil(plan.tier);
          const isActivating = activating === plan.tier;
          // The cheapest term, so the card leads with an entry price rather than the annual one.
          const fromPrice = subscriptionPriceFor(plan.tier, 1, 1, planPricing);

          return (
            <View
              key={plan.tier}
              style={[
                styles.card,
                { borderColor: until ? colors.green : colors.border, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.cardTitleRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Icon name={plan.icon} size={17} color={colors.green} />
                  <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.text }}>
                    {plan.title}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.green }}>
                  {ios ? (iosPrices[appleSubscriptionsFor(plan.tier)[0].productId] ?? "") : `₹${fromPrice}/mo`}
                </Text>
              </View>
              <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{plan.audience}</Text>

              <View style={{ gap: 7, marginTop: 12 }}>
                {plan.features(planPricing, ios).map((feature) => (
                  <View key={feature} style={{ flexDirection: "row", gap: 7 }}>
                    <Icon name="check" size={13} color={colors.green} />
                    <Text style={{ flex: 1, fontSize: 13, color: colors.textSoft, lineHeight: 18 }}>{feature}</Text>
                  </View>
                ))}
              </View>

              {until ? (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.green, marginTop: 14 }}>
                  Active until {until.toLocaleDateString()}
                </Text>
              ) : isActivating ? (
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.green, marginTop: 14 }}>
                  Activating your subscription…
                </Text>
              ) : (
                <Pressable
                  onPress={() => onSubscribe(plan.tier)}
                  style={[styles.filledCta, { backgroundColor: colors.green }]}
                >
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13.5 }}>
                    Choose {plan.title}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="phone" size={17} color={colors.green} />
            <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.text }}>
              Contact reveal credits
            </Text>
          </View>
          <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 }}>
            Not a subscription — pay-as-you-go for viewing a listing&rsquo;s phone number and email. Every account
            starts with free reveals; buy more from any listing&rsquo;s &ldquo;View Contact&rdquo; button, or check
            your balance under Account.
          </Text>
          <Pressable
            onPress={() => router.push("/account")}
            style={[styles.outlineCta, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          >
            <View style={styles.ctaRow}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>See your credits</Text>
              <Icon name="chevronRight" size={13} color={colors.green} />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {ios && iosTier && (
        <IosSubscribeSheet
          visible
          tier={iosTier}
          onClose={() => setIosTier(null)}
          onPurchased={() => void refreshProfile()}
        />
      )}

      {/* Android-only, and not merely unreachable on iOS: onSubscribe short-circuits to the
          website there, and this never mounts — same belt-and-braces shape as PostAdWizard's
          own BoostModal guard. */}
      {Platform.OS === "android" && accessToken && subscribeTier && (
        <SubscribeModal
          visible
          tier={subscribeTier}
          accessToken={accessToken}
          planPricing={planPricing}
          onClose={() => setSubscribeTier(null)}
          onActivating={() => setActivating(subscribeTier)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  outlineCta: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 14 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  filledCta: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 },
});
